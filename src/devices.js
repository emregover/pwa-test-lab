export const el = id => document.getElementById(id);
export const mediaSupported = () => !!navigator.mediaDevices?.getUserMedia;
export const stopStream = stream => stream?.getTracks().forEach(track => track.stop());

let activeRelease;
export function takeMedia(release) {
  if (activeRelease && activeRelease !== release) activeRelease();
  activeRelease = release;
}
export function releaseMedia(release) {
  if (activeRelease === release) activeRelease = undefined;
}
export function mediaError(error) {
  if (error.name === 'NotAllowedError') return 'Kamera veya mikrofon izni verilmedi.';
  if (error.name === 'NotFoundError') return 'Uygun kamera veya mikrofon bulunamadı.';
  if (error.name === 'NotReadableError') return 'Cihaz kullanılamıyor. Açık diğer kamera uygulamalarını kapat.';
  return 'İşlem tamamlanamadı. Tarayıcıyı ve bağlantıyı kontrol et.';
}

export function stopActiveMedia() { activeRelease?.(); }
