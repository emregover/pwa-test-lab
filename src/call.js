import { Peer } from 'peerjs';
import QRCode from 'qrcode';
import { el, mediaError, mediaSupported, releaseMedia, stopStream, takeMedia } from './devices.js';

export const validRoom = value => /^lab-[0-9a-f]{32}$/.test(value || '');
const inviteRoom = new URL(location.href).searchParams.get('room');

export function setupCall() {
  const start = el('start-call');
  const status = el('call-status');
  const local = el('local');
  const remote = el('remote');
  const resume = el('resume-video');
  const mic = el('mic');
  const camera = el('camera');
  const end = el('end-call');
  const network = el('call-network');
  let peer, session, stream, timeout;
  let generation = 0;
  let facing = 'user';

  if (validRoom(inviteRoom)) start.textContent = 'Görüşmeye katıl';
  if (!mediaSupported() || !window.RTCPeerConnection) {
    start.disabled = true;
    status.textContent = 'Bu tarayıcıda WebRTC veya medya erişimi yok.';
  } else if (inviteRoom && !validRoom(inviteRoom)) {
    status.textContent = 'Davet bağlantısı geçersiz. Yeni oda oluşturabilirsin.';
  }

  function finish(message = '') {
    generation++;
    clearTimeout(timeout);
    const old = peer;
    peer = undefined;
    session = undefined;
    old?.destroy();
    stopStream(stream);
    stream = undefined;
    releaseMedia(finish);
    local.srcObject = remote.srcObject = null;
    el('stage-message').hidden = false;
    local.hidden = mic.hidden = camera.hidden = end.hidden = resume.hidden = network.hidden = el('invite').hidden = true;
    mic.textContent = 'Mikrofonu kapat';
    mic.setAttribute('aria-pressed', 'false');
    status.textContent = message;
    start.hidden = false;
    start.disabled = false;
  }

  function setCall(call, current) {
    session = call;
    call.on('stream', other => {
      if (current !== generation) return;
      remote.srcObject = other;
      el('stage-message').hidden = true;
      remote.play().catch(() => { if (current === generation) resume.hidden = false; });
    });
    call.on('close', () => { if (current === generation) finish('Görüşme sona erdi.'); });
    call.on('error', () => { if (current === generation) finish('Görüşme bağlantısında hata oluştu.'); });
    const connection = call.peerConnection;
    if (!connection) return;
    connection.addEventListener('connectionstatechange', async () => {
      if (current !== generation) return;
      if (connection.connectionState === 'connected') {
        clearTimeout(timeout);
        status.textContent = 'Bağlandı.';
        try {
          const stats = await connection.getStats();
          if (current !== generation) return;
          const transport = [...stats.values()].find(stat => stat.selectedCandidatePairId);
          const pair = stats.get(transport?.selectedCandidatePairId);
          const types = [stats.get(pair?.localCandidateId)?.candidateType, stats.get(pair?.remoteCandidateId)?.candidateType];
          if (types.every(Boolean)) {
            network.textContent = types.includes('relay') ? 'TURN üzerinden' : 'Doğrudan bağlantı';
            network.hidden = false;
          }
        } catch { /* The connection can work without ICE route statistics. */ }
      } else if (connection.connectionState === 'failed') {
        finish('İki cihaz arasında bağlantı kurulamadı. Ağ değiştirip tekrar dene.');
      }
    });
    timeout = setTimeout(() => {
      if (current === generation && connection.connectionState !== 'connected') {
        finish('Görüşme bağlantısı zaman aşımına uğradı.');
      }
    }, 28_000);
  }

  start.addEventListener('click', async () => {
    takeMedia(finish);
    const current = ++generation;
    start.disabled = true;
    end.hidden = false;
    status.textContent = 'Kamera ve mikrofon izni bekleniyor…';
    const joining = validRoom(inviteRoom);
    const id = joining ? undefined : 'lab-' + crypto.randomUUID().replace(/-/g, '');
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: true, video: { facingMode: 'user' },
      });
      if (current !== generation) { stopStream(next); return; }
      stream = next;
      facing = 'user';
      local.srcObject = stream;
      local.hidden = mic.hidden = camera.hidden = start.disabled = false;
      start.hidden = true;
      status.textContent = 'Sinyalleşme bağlantısı kuruluyor…';
      peer = id ? new Peer(id) : new Peer();
      timeout = setTimeout(() => {
        if (current === generation) finish('Oda servisine bağlanılamadı.');
      }, 18_000);
      peer.on('error', error => {
        if (current !== generation) return;
        finish(error.type === 'peer-unavailable' ? 'Oda bulunamadı. Odayı açan kişi sayfayı açık tutmalı.' : 'Oda servisiyle bağlantı kurulamadı.');
      });
      peer.on('call', call => {
        if (current !== generation || joining || session) { call.close(); return; }
        status.textContent = 'Karşı tarafın bağlantısı bekleniyor…';
        call.answer(stream);
        setCall(call, current);
      });
      peer.on('open', async () => {
        if (current !== generation) return;
        clearTimeout(timeout);
        if (joining) {
          status.textContent = 'Odaya bağlanılıyor…';
          const call = peer.call(inviteRoom, stream);
          if (call) setCall(call, current);
          else finish('Görüşme başlatılamadı.');
          return;
        }
        const url = new URL('/', location.origin);
        url.searchParams.set('room', id);
        el('room-url').value = url.href;
        el('invite').hidden = false;
        status.textContent = 'Davet bağlantısını veya QR kodunu paylaş.';
        try {
          const qr = await QRCode.toDataURL(url.href, { width: 260, margin: 2 });
          if (current === generation) el('invite-qr').src = qr;
        } catch {
          if (current === generation) el('invite-qr').hidden = true;
        }
      });
    } catch (error) {
      if (current === generation) finish(mediaError(error));
    }
  });

  end.addEventListener('click', () => finish('Görüşme sona erdi.'));
  resume.addEventListener('click', async () => {
    try { await remote.play(); resume.hidden = true; }
    catch { status.textContent = 'Tarayıcı ses veya görüntü oynatmayı engelledi.'; }
  });
  mic.addEventListener('click', () => {
    const track = stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    mic.setAttribute('aria-pressed', String(!track.enabled));
    mic.textContent = track.enabled ? 'Mikrofonu kapat' : 'Mikrofonu aç';
  });
  camera.addEventListener('click', async () => {
    const current = generation;
    const previous = stream?.getVideoTracks()[0];
    if (!previous) return;
    camera.disabled = true;
    const target = facing === 'user' ? 'environment' : 'user';
    const swap = async mode => {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: mode } } });
      const track = next.getVideoTracks()[0];
      if (current !== generation) { stopStream(next); return; }
      try {
        const sender = session?.peerConnection?.getSenders().find(item => item.track?.kind === 'video');
        await sender?.replaceTrack(track);
        if (current !== generation) { stopStream(next); return; }
        stream.removeTrack(previous);
        stream.addTrack(track);
        local.srcObject = new MediaStream(stream.getTracks());
        facing = mode;
      } catch (error) { stopStream(next); throw error; }
    };
    previous.stop();
    try { await swap(target); }
    catch {
      if (current === generation) {
        try { await swap(facing); }
        catch { if (current === generation) status.textContent = 'Kamera açılamadı. Görüşme sesli devam edebilir.'; }
        if (current === generation && stream.getVideoTracks()[0]?.readyState === 'live') status.textContent = 'Diğer kamera kullanılamıyor.';
      }
    } finally { camera.disabled = false; }
  });
  el('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(el('room-url').value); status.textContent = 'Davet bağlantısı kopyalandı.'; }
    catch { el('room-url').select(); status.textContent = 'Bağlantıyı seçili alandan kopyalayabilirsin.'; }
  });
  el('share').hidden = typeof navigator.share !== 'function';
  el('share').addEventListener('click', async () => {
    try { await navigator.share({ title: 'Bire bir görüşme', url: el('room-url').value }); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = 'Bağlantıyı kopyalayarak paylaşabilirsin.'; }
  });
}
