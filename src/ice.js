export async function getManagedIceServers() {
  try {
    const response = await fetch('/api/ice', {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (response.status !== 200) return [];
    const data = await response.json();
    return Array.isArray(data.iceServers) ? data.iceServers : [];
  } catch {
    return [];
  }
}

export function describeIce({ phase, connectionState, iceState, relay, errors, managed }) {
  const settings = managed ? 'TURN/TLS 443 yapılandırıldı' : 'PeerJS varsayılan TURN';
  const call = phase === 'media'
    ? ['Medya', connectionState || 'new', 'ICE ' + (iceState || 'new'), relay ? 'TURN adayı alındı' : 'TURN adayı görülmedi']
    : [phase === 'room' ? 'Oda servisi hazır' : 'Oda servisine bağlanılıyor'];
  return [...call, settings, ...(errors.size ? ['ICE hata kodu ' + [...errors].join(', ')] : [])].join(' · ');
}
