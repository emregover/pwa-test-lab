import { el, mediaError, mediaSupported, releaseMedia, stopStream, takeMedia } from './devices.js';

export function setupMedia(getCallMedia) {
  const preview = el('media-preview');
  const status = el('media-status');
  const output = el('media-output');
  const photo = el('photo');
  const voice = el('voice');
  const movie = el('movie');
  const capture = el('capture');
  const stop = el('media-stop');
  let stream, recorder, assetUrl;
  let ownsStream = false;
  let generation = 0;
  let supported = mediaSupported();
  const canRecord = supported && typeof MediaRecorder === 'function';
  el('media-support').textContent = supported ? 'İzin gerekli' : 'Kamera erişimi yok';
  photo.disabled = !supported;
  voice.disabled = movie.disabled = !canRecord;

  function finish() {
    generation++;
    if (recorder?.state === 'recording') recorder.stop();
    recorder = undefined;
    if (ownsStream) stopStream(stream);
    stream = undefined;
    ownsStream = false;
    preview.srcObject = null;
    preview.hidden = capture.hidden = stop.hidden = true;
    photo.disabled = !supported;
    voice.disabled = movie.disabled = !canRecord;
    releaseMedia(finish);
  }

  let outputVersion = 0;
  function show(blob, filename) {
    if (assetUrl) URL.revokeObjectURL(assetUrl);
    assetUrl = URL.createObjectURL(blob);
    output.replaceChildren();
    const kind = blob.type.split('/')[0];
    if (kind === 'image' || kind === 'audio' || kind === 'video') {
      const item = document.createElement(kind === 'image' ? 'img' : kind);
      if (kind === 'image') item.alt = 'Fotoğraf önizlemesi';
      else { item.controls = true; item.playsInline = true; }
      item.src = assetUrl;
      output.append(item);
    }
    const save = document.createElement('a');
    save.href = assetUrl;
    save.download = filename;
    save.textContent = filename + ' indir';
    output.append(save);
  }

  async function begin(mode) {
    const call = getCallMedia();
    if (call && mode !== 'voice') {
      status.textContent = 'Kamera görüşmede kullanılıyor. Bu testi görüşme sonrasında açabilirsin.';
      return;
    }
    const callMic = call?.stream?.getAudioTracks().find(track => track.readyState === 'live');
    if (call && !callMic) {
      status.textContent = 'Görüşme mikrofonu hazır olunca ses kaydını başlatabilirsin.';
      return;
    }
    const currentOutput = ++outputVersion;
    finish();
    if (!callMic) takeMedia(finish);
    const current = generation;
    photo.disabled = voice.disabled = movie.disabled = true;
    stop.hidden = false;
    status.textContent = 'Cihaz izni bekleniyor…';
    try {
      const next = callMic ? new MediaStream([callMic]) : await navigator.mediaDevices.getUserMedia({
        audio: mode !== 'photo', video: mode !== 'voice' && { facingMode: 'environment' },
      });
      if (current !== generation) { if (!callMic) stopStream(next); return; }
      stream = next;
      ownsStream = !callMic;
      el('media-support').textContent = 'İzin verildi';
      if (mode !== 'voice') { preview.srcObject = stream; preview.hidden = false; }
      if (mode === 'photo') {
        capture.hidden = false;
        status.textContent = 'Hazır olduğunda Çek düğmesine dokun.';
        return;
      }
      const chunks = [];
      const currentRecorder = new MediaRecorder(stream);
      recorder = currentRecorder;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (current === generation) { finish(); status.textContent = 'Kayıt sırasında hata oluştu.'; }
      };
      recorder.onstop = () => {
        if (recorder === currentRecorder) finish();
        if (currentOutput !== outputVersion) return;
        if (!chunks.length) {
          if (status.textContent.startsWith('Kayıt yapılıyor') || status.textContent.startsWith('Mikrofon kaydediliyor')) {
            status.textContent = 'Kayıt dosyası oluşmadı.';
          }
          return;
        }
        const type = currentRecorder.mimeType || chunks[0].type;
        const extension = type.split(';')[0].split('/')[1] || 'webm';
        show(new Blob(chunks, { type }), (mode === 'voice' ? 'ses.' : 'video.') + extension);
        status.textContent = 'Kayıt hazır.';
      };
      recorder.start();
      status.textContent = callMic
        ? 'Mikrofon kaydediliyor. Karşı tarafın sesi kayda dahil edilmez. Mikrofon kapalıyken kayıt sessizdir.'
        : 'Kayıt yapılıyor…';
    } catch (error) {
      if (current === generation) { finish(); status.textContent = mediaError(error); }
    }
  }

  photo.addEventListener('click', () => void begin('photo'));
  voice.addEventListener('click', () => void begin('voice'));
  movie.addEventListener('click', () => void begin('movie'));
  stop.addEventListener('click', () => { finish(); status.textContent = 'Durduruldu.'; });
  capture.addEventListener('click', () => {
    if (!preview.videoWidth) { status.textContent = 'Kamera henüz hazır değil.'; return; }
    const currentOutput = outputVersion;
    const canvas = document.createElement('canvas');
    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;
    canvas.getContext('2d').drawImage(preview, 0, 0);
    canvas.toBlob(blob => {
      if (currentOutput !== outputVersion || !blob) return;
      show(blob, 'fotograf.jpg');
      status.textContent = 'Fotoğraf hazır.';
    }, 'image/jpeg', 0.9);
    finish();
  });
  el('media-file').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    outputVersion++;
    finish();
    show(file, file.name);
    status.textContent = 'Dosya seçildi.';
    event.target.value = '';
  });
  window.addEventListener('pagehide', () => {
    outputVersion++;
    finish();
    if (assetUrl) URL.revokeObjectURL(assetUrl);
    assetUrl = undefined;
    output.replaceChildren();
  });

  setupScanner(getCallMedia);
}

function setupScanner(getCallMedia) {
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
