import { el } from './devices.js';

const testDuration = 120_000;

export function setupOtpTest() {
  const start = el('otp-start');
  const template = el('otp-sms');
  const input = el('otp-code');
  const status = el('otp-status');
  let test;

  function endTest() {
    const previous = test;
    test = undefined;
    if (!previous) return;
    clearTimeout(previous.timeout);
    previous.controller.abort();
  }

  function verify(attempt, code, automatic) {
    if (!attempt || test !== attempt) return;
    if (Date.now() >= attempt.deadline) {
      endTest();
      status.textContent = 'Test süresi doldu. Yeni bir test başlat.';
      return;
    }
    if (code !== attempt.code) {
      status.textContent = 'Kod eşleşmedi. Bu test için hazırlanan SMS’teki kodu dene.';
      return;
    }
    endTest();
    status.textContent = automatic ? 'WebOTP başarılı. Kod SMS’ten otomatik alındı.' : 'Kod doğru. Elle giriş veya klavye önerisi doğrulandı.';
  }

  start.addEventListener('click', async () => {
    endTest();
    const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
    const attempt = { code, deadline: Date.now() + testDuration, controller: new AbortController() };
    test = attempt;
    attempt.timeout = setTimeout(() => {
      if (test !== attempt) return;
      endTest();
      status.textContent = 'Test süresi doldu. Yeni bir test başlat.';
    }, testDuration);
    input.value = '';
    template.value = 'Test kodunuz: ' + code + '\n\n@' + location.hostname + ' #' + code;
    el('otp-test').hidden = false;
    start.textContent = 'Yeni SMS testi başlat';

    if (!('OTPCredential' in window) || !navigator.credentials?.get) {
      status.textContent = 'SMS geldikten sonra klavye önerisini kullanabilir veya kodu elle girebilirsin.';
      return;
    }
    status.textContent = 'SMS bekleniyor. Tarayıcı kodu kullanmayı teklif ederse onayla.';
    try {
      const credential = await navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: attempt.controller.signal,
      });
      if (test !== attempt || !credential?.code) return;
      input.value = credential.code;
      verify(attempt, credential.code, true);
    } catch {
      if (test === attempt) status.textContent = 'Otomatik okuma tamamlanmadı. Gelen kodu elle girebilirsin.';
    }
  });

  el('otp-form').addEventListener('submit', event => {
    event.preventDefault();
    if (test) verify(test, input.value, false);
    else status.textContent = 'Yeni bir SMS testi başlat.';
  });
  el('otp-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(template.value); }
    catch { template.select(); }
  });
  window.addEventListener('pagehide', endTest);
}
