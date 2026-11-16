# PWA Test Laboratuvarı · V1

Bire bir WebRTC görüşmesi, davet bağlantısı ve QR kod, ön/arka kamera değiştirme, mikrofon kapatma, fotoğraf, ses/video kaydı ve QR/barkod taraması.

## Çalıştırma

```sh
npm ci
npm run dev
npm run build
```

Kamera ve mikrofon için localhost veya HTTPS kullan. Telefonda test için Vercel'e ayrı bir Vite projesi olarak aktar. Bulut testi için iki cihazda aynı yayın adresini kullan.

## Görüşmeyi test et

1. İlk cihazda **Oda oluştur** ve kamera/mikrofon iznini ver.
2. İkinci cihazda davet bağlantısını aç veya QR kodunu okut. **Görüşmeye katıl** düğmesine dokun.
3. İki yönlü ses ve görüntüyü, mikrofonu kapatmayı ve kamera değiştirmeyi dene.
4. Cihazlardan birini mobil veriye geçir ve yeni oda ile tekrar dene.

V1, PeerJS Cloud sinyalleşmesini ve kayıtlı PeerJS sürümünün varsayılan STUN/TURN yapılandırmasını kullanır. Bulut servisi ve ağ koşulları bağlantıyı etkileyebilir. Fotoğraflar ve yerel ses/video kayıtları tarayıcı içinde işlenir. Görüşme kaydı tutulmaz.
