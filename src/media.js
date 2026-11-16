import { el, mediaError, mediaSupported, releaseMedia, stopStream, takeMedia } from './devices.js';

export function setupScanner(getCallMedia) {
  const scan = el('scan');
  const stop = el('scan-stop');
  const video = el('scan-preview');
  const status = el('scan-status');
  const openRoom = el('scan-room');
  let generation = 0;
  let controls;
  let stream;
  let readerPromise;
  const reader = () => readerPromise ??= import('@zxing/browser').then(({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader()).catch(error => {
    readerPromise = undefined;
    throw error;
  });
  scan.disabled = !mediaSupported();
  el('scan-support').textContent = scan.disabled ? 'Görselden okutma' : 'Kamera izni gerekli';

  function finish() {
    generation++;
    controls?.stop();
    controls = undefined;
    stopStream(stream);
    stream = undefined;
    video.srcObject = null;
    video.hidden = stop.hidden = true;
    scan.disabled = !mediaSupported();
    releaseMedia(finish);
  }
  function result(value) {
    status.textContent = value;
    openRoom.hidden = true;
    try {
      const url = new URL(value);
      if (url.origin === location.origin && url.pathname === '/' && /^lab-[0-9a-f]{32}$/.test(url.searchParams.get('room') || '')) {
        openRoom.href = url.href;
        openRoom.hidden = false;
      }
    } catch { /* Non-URL barcodes are shown as text. */ }
  }

  scan.addEventListener('click', async () => {
    if (getCallMedia()) {
      status.textContent = 'Kamera görüşmede kullanılıyor. Tarama için bir görsel seçebilir veya görüşmenin bitmesini bekleyebilirsin.';
      return;
    }
    takeMedia(finish);
    const current = ++generation;
    scan.disabled = true;
    stop.hidden = false;
    openRoom.hidden = true;
    status.textContent = 'Kamera izni bekleniyor…';
    try {
      const decoder = await reader();
      if (current !== generation) return;
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (current !== generation) { stopStream(next); return; }
      stream = next;
      video.hidden = false;
      el('scan-support').textContent = 'İzin verildi';
      status.textContent = 'Kamerayı QR kod veya barkoda tut.';
      const active = await decoder.decodeFromStream(next, video, (match, _error, scanner) => {
        if (!match || current !== generation) return;
        scanner.stop();
        finish();
        result(match.getText());
      });
      if (current === generation) controls = active;
      else active.stop();
    } catch (error) {
      if (current === generation) { finish(); status.textContent = mediaError(error); }
    }
  });
  stop.addEventListener('click', () => { finish(); status.textContent = 'Tarama durduruldu.'; });
  el('scan-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    finish();
    const current = generation;
    openRoom.hidden = true;
    status.textContent = 'Görsel okunuyor…';
    const url = URL.createObjectURL(file);
    try {
      const match = await (await reader()).decodeFromImageUrl(url);
      if (current === generation) result(match.getText());
    } catch {
      if (current === generation) status.textContent = 'Görselde okunabilir QR kod veya barkod bulunamadı.';
    } finally { URL.revokeObjectURL(url); }
  });
}
