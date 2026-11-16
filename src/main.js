import './style.css';
import { setupCall } from './call.js';
import { setupMedia } from './media.js';

import { el, stopActiveMedia } from './devices.js';

setupCall();
setupMedia();
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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
