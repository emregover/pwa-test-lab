import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { sendNotification } from 'web-push';

const pushHosts = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);
const headers = { 'Cache-Control': 'no-store' };
const linkLifetime = 10 * 60 * 1000;
const base64url = /^[A-Za-z0-9_-]+$/;
const roomId = /^lab-[0-9a-f]{32}$/;

function validKey(value, bytes) {
  return typeof value === 'string' && base64url.test(value) &&
    Buffer.from(value, 'base64url').length === bytes;
}

function sanitizeSubscription(value) {
  try {
    const { endpoint, keys } = value;
    if (typeof endpoint !== 'string' || endpoint.length > 2048) return;
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || !pushHosts.has(url.hostname) ||
      url.port || url.username || url.password || url.hash ||
      !validKey(keys?.p256dh, 65) || !validKey(keys.auth, 16)) return;
    return { endpoint: url.href, keys: { p256dh: keys.p256dh, auth: keys.auth } };
  } catch {
    return;
  }
}

function seal(subscription, key, origin) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(origin));
  const data = cipher.update(JSON.stringify({ subscription, expires: Date.now() + linkLifetime }));
  return Buffer.concat([nonce, cipher.final(), data, cipher.getAuthTag()]).toString('base64url');
}

function unseal(token, key, origin) {
  if (typeof token !== 'string' || token.length > 4096 || !base64url.test(token)) return;
  try {
    const data = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
    decipher.setAAD(Buffer.from(origin));
    decipher.setAuthTag(data.subarray(-16));
    const value = JSON.parse(Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]));
    if (value.expires > Date.now()) return sanitizeSubscription(value.subscription);
  } catch {
    return;
  }
}

function json(body, status = 200) {
  return Response.json(body, { status, headers });
}

export default {
  async fetch(request) {
    if (!['GET', 'POST'].includes(request.method)) {
      return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
    }

    let keys;
    try { keys = JSON.parse(process.env.PUSH_VAPID_KEYS ?? 'null'); }
    catch { /* The feature remains unavailable until the project has valid keys. */ }
    if (!validKey(keys?.publicKey, 65) || !validKey(keys?.privateKey, 32)) {
      return json({ error: 'Bildirim servisi henüz yapılandırılmadı.' }, 503);
    }
    if (request.method === 'GET') return json({ publicKey: keys.publicKey });

    const { origin } = new URL(request.url);
    if (request.headers.get('Origin') !== origin) return json({ error: 'İstek reddedildi.' }, 403);

    let body;
    try {
      const raw = await request.text();
      if (raw.length > 5000) return json({ error: 'İstek çok büyük.' }, 413);
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'İstek okunamadı.' }, 400);
    }

    const key = createHash('sha256').update('pwa-lab push link v1\0').update(keys.privateKey).digest();
    if (body?.action === 'link') {
      const subscription = sanitizeSubscription(body.subscription);
      if (!subscription) return json({ error: 'Tarayıcının bildirim aboneliği desteklenmiyor.' }, 400);
      return json({ token: seal(subscription, key, origin) });
    }

    if (body?.action !== 'send' || typeof body.room !== 'string' || !roomId.test(body.room)) {
      return json({ error: 'Geçerli bir görüşme odası gerekiyor.' }, 400);
    }
    const subscription = unseal(body.token, key, origin);
    if (!subscription) return json({ error: 'Davet alma bağlantısı geçersiz veya süresi doldu.' }, 400);

    try {
      await sendNotification(subscription, JSON.stringify({ room: body.room }), {
        TTL: 120,
        timeout: 5000,
        topic: 'meeting-invite',
        vapidDetails: { subject: 'https://brandntrend.com', ...keys },
      });
      return json({ sent: true });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        return json({ error: 'Bildirim aboneliği kapandı. Alıcıdan yeni bir bağlantı iste.' }, 410);
      }
      return json({ error: 'Bildirim servisi daveti kabul etmedi. Daha sonra tekrar dene.' }, 502);
    }
  },
};
