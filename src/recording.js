import { el, stopStream } from './devices.js';

export function setupRecording() {
  const record = el('record-meeting');
  const allow = el('allow-recording');
  const decline = el('decline-recording');
  const stop = el('stop-recording');
  const notice = el('recording-notice');
  const result = el('recording-result');
  const resultStatus = el('recording-result-status');
  const audio = el('meeting-audio');
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  let link, local, remote, job, request, file, objectUrl;
  let finished = true;
  const supported = !!AudioContextType && typeof MediaRecorder === 'function';

  function render(message) {
    if (message !== undefined) notice.textContent = message;
    record.disabled = finished || !supported || !link?.open
      || !local?.getAudioTracks().length || !remote?.getAudioTracks().length || !!job || !!request;
    allow.hidden = decline.hidden = request?.state !== 'asked';
    stop.hidden = job?.state !== 'recording' && request?.state !== 'recording';
  }

  function send(type, id) {
    if (!link?.open) return false;
    try { link.send({ type, id }); return true; }
    catch { return false; }
  }

  function storeRecording(state) {
    if (!state.chunks.length) {
      resultStatus.textContent = 'Kayıtta oynatılabilir ses bulunamadı.';
      result.hidden = false;
      el('play-recording').disabled = el('share-recording').disabled = !file;
      return;
    }
    const type = state.recorder.mimeType || state.chunks[0].type || 'audio/webm';
    const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    file = new File(state.chunks, 'toplanti-ses-kaydi.' + extension, { type });
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    audio.hidden = true;
    resultStatus.textContent = '';
    el('play-recording').disabled = el('share-recording').disabled = false;
    result.hidden = false;
  }

  function endLocal(message = 'Ses kaydı durduruldu.', notify = true) {
    const state = job;
    if (!state) return;
    job = undefined;
    clearTimeout(state.timer);
    if (notify) send('stop', state.id);
    if (state.recorder?.state !== undefined && state.recorder.state !== 'inactive') state.recorder.stop();
    else {
      stopStream(state.mix?.stream);
      void state.context.close().catch(() => {});
    }
    render(message);
  }

  function endCall() {
    finished = true;
    endLocal('Görüşme bitti.');
    const previous = link;
    link = local = remote = request = undefined;
    previous?.close();
    if (file) result.hidden = false;
    render('Kayıt için iki katılımcının onayı gerekir.');
  }

  function onMessage(message) {
    if (finished || !message || typeof message.id !== 'string') return;
    const { type, id } = message;
    if (type === 'ask') {
      if (job || request) { send('deny', id); return; }
      request = { id, state: 'asked' };
      render('Karşı taraf toplantının sesini kaydetmek istiyor.');
      return;
    }
    if (job?.id === id && (type === 'deny' || type === 'stop')) {
      endLocal(type === 'deny' ? 'Kayıt isteği kabul edilmedi.' : 'Karşı taraf kaydı durdurdu.', false);
      return;
    }
    if (job?.id === id && job.state === 'waiting' && type === 'allow') {
      const state = job;
      state.state = 'starting';
      void startCapture(state);
      return;
    }
    if (request?.id !== id) return;
    if (type === 'recording' && request.state === 'allowed') {
      request.state = 'recording';
      render('Toplantının sesi kaydediliyor.');
    } else if (type === 'stop') {
      request = undefined;
      render('Kayıt sona erdi.');
    }
  }

  async function startCapture(state) {
    try {
      await state.ready;
      if (job !== state) return;
      const mix = state.context.createMediaStreamDestination();
      state.mix = mix;
      for (const source of [local, remote]) {
        const track = source.getAudioTracks().find(item => item.readyState === 'live');
        if (!track) throw new Error('Missing audio track');
        const node = state.context.createMediaStreamSource(new MediaStream([track]));
        const gain = state.context.createGain();
        gain.gain.value = 0.5;
        node.connect(gain).connect(mix);
      }
      const recorder = new MediaRecorder(mix.stream);
      state.recorder = recorder;
      recorder.ondataavailable = event => { if (event.data.size) state.chunks.push(event.data); };
      recorder.onstop = () => {
        stopStream(mix.stream);
        void state.context.close().catch(() => {});
        if (job === state) {
          job = undefined;
          send('stop', state.id);
          render('Ses kaydı durduruldu.');
        }
        if (!state.discard) storeRecording(state);
        if (!finished) result.hidden = true;
      };
      recorder.onerror = () => { if (job === state) endLocal('Ses kaydı tamamlanamadı.'); };
      recorder.start();
      if (!send('recording', state.id)) throw new Error('Recording control disconnected');
      clearTimeout(state.timer);
      state.state = 'recording';
      render('Toplantının sesi kaydediliyor.');
    } catch {
      state.discard = true;
      if (job === state) endLocal('Ses kaydı başlatılamadı.');
    }
  }

  record.addEventListener('click', () => {
    if (record.disabled) return;
    try {
      const id = crypto.randomUUID();
      const context = new AudioContextType();
      const ready = context.resume();
      void ready.catch(() => {});
      job = { id, context, ready, state: 'waiting', chunks: [] };
      if (!send('ask', id)) { endLocal('Kayıt isteği gönderilemedi.', false); return; }
      job.timer = setTimeout(() => endLocal('Kayıt isteği zaman aşımına uğradı.'), 30_000);
      render('Karşı tarafın kayıt onayı bekleniyor…');
    } catch { endLocal('Ses kaydı başlatılamadı.'); render('Ses kaydı başlatılamadı.'); }
  });
  allow.addEventListener('click', () => {
    if (request?.state !== 'asked') return;
    if (send('allow', request.id)) {
      request.state = 'allowed';
      render('Onay verildi. Kaydın başlaması bekleniyor…');
    } else {
      request = undefined;
      render('Kayıt onayı gönderilemedi.');
    }
  });
  decline.addEventListener('click', () => {
    if (request?.state !== 'asked') return;
    send('deny', request.id);
    request = undefined;
    render('Kayıt isteğini reddettin.');
  });
  stop.addEventListener('click', () => {
    if (job) endLocal();
    else if (request?.state === 'recording') {
      send('stop', request.id);
      request = undefined;
      render('Ses kaydı durduruldu.');
    }
  });
  el('play-recording').addEventListener('click', async () => {
    if (!file) return;
    audio.hidden = false;
    try { await audio.play(); }
    catch { resultStatus.textContent = 'Kaydı ses oynatıcısından başlatabilirsin.'; }
  });
  el('share-recording').addEventListener('click', async () => {
    if (!file) return;
    const data = { files: [file] };
    try {
      if (navigator.share && navigator.canShare?.(data)) {
        await navigator.share(data);
        return;
      }
    } catch (error) { if (error.name === 'AbortError') return; }
    const download = document.createElement('a');
    download.href = objectUrl;
    download.download = file.name;
    download.click();
    resultStatus.textContent = 'Dosya indirildi. İndirilenler bölümünden paylaşabilirsin.';
  });

  return {
    startCall() {
      finished = false;
      audio.pause();
      audio.hidden = true;
      result.hidden = true;
      render('Kayıt için karşı tarafın bağlanması gerekiyor.');
    },
    setStreams(own, other) { local = own; remote = other; render(); },
    attach(channel) {
      if (finished || link) { channel.close(); return; }
      link = channel;
      channel.on('open', () => { if (link === channel) render(); });
      channel.on('data', message => { if (link === channel) onMessage(message); });
      const closed = () => {
        if (link !== channel) return;
        link = request = undefined;
        endLocal('Kayıt bağlantısı kesildi.', false);
        render('Kayıt bağlantısı kesildi.');
      };
      channel.on('close', closed);
      channel.on('error', closed);
      render();
    },
    endCall,
  };
}
