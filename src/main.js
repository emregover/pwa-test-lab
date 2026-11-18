import './style.css';
import { setupCall } from './call.js';
import { setupScanner } from './media.js';
import { setupRecording } from './recording.js';
import { setupOtpTest } from './otp.js';
import { setupPush } from './push.js';

import { el, stopActiveMedia } from './devices.js';

const getCallMedia = setupCall(setupRecording());
setupScanner(getCallMedia);
setupOtpTest();
window.addEventListener('pagehide', stopActiveMedia);

let installPrompt;
const install = el('install');
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  install.hidden = false;
});
install.addEventListener('click', async () => {
  const event = installPrompt;
  installPrompt = undefined;
  install.hidden = true;
  await event?.prompt();
});

const worker = import.meta.env.PROD && 'serviceWorker' in navigator
  ? navigator.serviceWorker.register('/sw.js').then(async registration => {
    if (registration.active) return registration;
    return navigator.serviceWorker.ready;
  }).catch(() => null)
  : null;
setupPush(worker);
