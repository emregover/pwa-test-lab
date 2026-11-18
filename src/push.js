import { validRoom } from './call.js';
import { el } from './devices.js';

function decodeKey(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

async function pushApi(body) {
  const response = await (body ? fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) : fetch('/api/push'));
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export function setupPush(worker) {
  const enable = el('push-enable');
  const status = el('push-status');
  const link = el('push-link');
  const share = el('push-share');
  const sender = el('push-sender');
  const senderStatus = el('push-sender-status');
  const send = el('push-send');
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token = fragment.get('push-to');

  if (token) {
    history.replaceState(history.state, '', location.pathname + location.search + '#meeting');
    sender.hidden = false;
  }
  send.addEventListener('click', async () => {
    const input = el('room-url').value;
    const room = input && new URL(input).searchParams.get('room');
    if (el('invite').hidden || !validRoom(room)) {
      senderStatus.textContent = 'Önce bu sayfada bir görüşme odası oluştur.';
      return;
    }
    send.disabled = true;
    try {
      await pushApi({ action: 'send', room, token });
      senderStatus.textContent = 'Davet bildirim servisine gönderildi.';
    } catch (error) {
      senderStatus.textContent = error.message || 'Davet gönderilemedi.';
    } finally {
      send.disabled = false;
    }
  });

  if (!worker || !('PushManager' in window) || !('Notification' in window)) {
    enable.disabled = true;
    status.textContent = 'Bu tarayıcıda bildirimler kullanılamıyor. iPhone’da uygulamayı ana ekrana ekleyip oradan aç.';
    return;
  }
  enable.addEventListener('click', async () => {
    enable.disabled = true;
    el('push-link-result').hidden = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        status.textContent = 'Bildirim izni verilmedi. İzni tarayıcı veya cihaz ayarlarından açabilirsin.';
        return;
      }
      const [{ publicKey }, registration] = await Promise.all([pushApi(), worker]);
      if (!registration?.active) throw new Error('Bildirimler hazırlanıyor. Sayfayı yenileyip tekrar dene.');
      const applicationServerKey = decodeKey(publicKey);
      let subscription = await registration.pushManager.getSubscription();
      const currentKey = subscription?.options.applicationServerKey;
      if (currentKey && new Uint8Array(currentKey).some((byte, index) => byte !== applicationServerKey[index])) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const { token: recipient } = await pushApi({ action: 'link', subscription });
      link.value = new URL('/#push-to=' + recipient, location.origin).href;
      el('push-link-result').hidden = false;
      status.textContent = 'Bağlantıyı davet gönderecek kişiye ilet. Bağlantı 10 dakika geçerli.';
      enable.textContent = 'Yeni davet alma bağlantısı oluştur';
    } catch (error) {
      status.textContent = error.message || 'Bildirimler açılamadı.';
    } finally {
      enable.disabled = false;
    }
  });

  share.hidden = typeof navigator.share !== 'function';
  share.addEventListener('click', async () => {
    try { await navigator.share({ title: 'Görüşme bildirimi alma bağlantısı', url: link.value }); }
    catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'Bağlantıyı kopyalayarak paylaşabilirsin.';
    }
  });

  el('push-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      status.textContent = 'Bağlantı kopyalandı. Davet gönderecek kişiye ilet.';
    } catch {
      link.select();
      status.textContent = 'Bağlantıyı seçili alandan kopyalayabilirsin.';
    }
  });
}
