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

## Mobil veri ve TURN/TLS

Durum satırı oda bağlantısını ve medya bağlantısını ayrı gösterir. Medya aşamasında ICE durumu, TURN adayı ve varsa ICE hata kodu görünür.

Vercel **Production** ortamında `CLOUDFLARE_TURN_KEY_ID` ve `CLOUDFLARE_TURN_API_TOKEN` tanımlandığında `/api/ice` Cloudflare Realtime TURN üzerinden bir saatlik geçici kimlik bilgileri üretir. Uzun ömürlü API tokenı sunucuda kalır. Yeniden dağıtım sonrası bağlantı adaylarına TURN/TLS TCP 443 eklenir. Değişkenler yoksa mevcut PeerJS yapılandırması kullanılır. İnternet üzerinden erişilebilen bu test uygulamasında geçici TURN erişimi de ziyaretçilere açık olur. Ücretli kullanım açılacaksa kimlik doğrulaması ve kullanım sınırlarıyla dağıt.

Testi yeni odayla tekrarla. Bir cihaz Wi‑Fi’da, diğeri Turkcell mobil veride olsun. Odada iki yönlü ses ve görüntü geldiğini ve durum satırındaki bağlantı türünü kontrol et.
