export default {
  async fetch(request) {
    const headers = { 'Cache-Control': 'private, no-store' };
    if (request.method !== 'GET') {
      return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET' } });
    }
    const id = process.env.CLOUDFLARE_TURN_KEY_ID;
    const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
    if (!id || !token) return new Response(null, { status: 204, headers });

    try {
      const response = await fetch(
        'https://rtc.live.cloudflare.com/v1/turn/keys/' + encodeURIComponent(id) + '/credentials/generate-ice-servers',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: 3600 }),
          signal: AbortSignal.timeout(4000),
        },
      );
      if (!response.ok) return new Response(null, { status: 502, headers });
      const { iceServers } = await response.json();
      const relay = iceServers.find(server =>
        [server.urls].flat().includes('turns:turn.cloudflare.com:443?transport=tcp'));
      if (!relay?.username || !relay?.credential) return new Response(null, { status: 502, headers });
      return Response.json({ iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
          urls: [
            'turn:turn.cloudflare.com:3478?transport=udp',
            'turns:turn.cloudflare.com:443?transport=tcp',
          ],
          username: relay.username,
          credential: relay.credential,
        },
      ] }, { headers });
    } catch {
      return new Response(null, { status: 502, headers });
    }
  },
};
