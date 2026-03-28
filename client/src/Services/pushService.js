// small device id generator (no external dep)
function makeDeviceId() {
  return 'd_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
}

import { API_BASE } from '../Services/useMe';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      // Prefer existing registration if present
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js');

      // wait until the service worker is active
      if (reg.installing) {
        await new Promise((resolve) => {
          reg.installing.addEventListener('statechange', function listener(e) {
            if (reg.installing.state === 'activated') {
              reg.installing.removeEventListener('statechange', listener);
              resolve();
            }
          });
        });
      } else if (reg.waiting) {
        // waiting means installed but not yet active
        await new Promise((resolve) => {
          reg.waiting.addEventListener('statechange', function listener(e) {
            if (reg.waiting.state === 'activated') {
              reg.waiting.removeEventListener('statechange', listener);
              resolve();
            }
          });
        });
      }

      return reg;
    } catch (e) { }
  }
  return null;
}

async function getVapidPublicKey() {
  try {
    const r = await fetch(`${API_BASE}/api/push/vapid-public`, { credentials: 'include' });
    if (!r.ok) return null;
    const j = await r.json();
    return j.publicKey;
  } catch (e) { return null; }
}

export async function subscribeForPush() {
  try {
    if (!('Notification' in window)) return null;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    const reg = await registerServiceWorker();
    if (!reg) {
      return null;
    }
    if (!reg.pushManager) {
      return null;
    }

    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      return null;
    }

    // Ensure the publicKey is not the private key by basic sanity check
    if (publicKey.length < 20) {
      return null;
    }

    // Reuse existing subscription when present to avoid duplicates
    let existingSub = null;
    try {
      existingSub = await reg.pushManager.getSubscription();
    } catch (e) { }

    if (existingSub) {
      // ensure server has the subscription (upsert on server)
      try {
        await fetch(`${API_BASE}/api/push/subscribe`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: existingSub.toJSON(), deviceId: localStorage.getItem('push_device_id') || null }),
        });
      } catch (e) { }
      return existingSub;
    }

    // Create a new subscription
    let sub = null;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (e) {
      throw e;
    }

    // deviceId stored locally so we can unsubscribe this device on logout
    let deviceId = localStorage.getItem('push_device_id');
    if (!deviceId) {
      deviceId = makeDeviceId();
      localStorage.setItem('push_device_id', deviceId);
    }

    // send to server
    try {
      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), deviceId }),
      });
    } catch (e) { }

    return sub;
  } catch (e) {
    return null;
  }
}

export async function unsubscribePush() {
  try {
    const deviceId = localStorage.getItem('push_device_id');
    if (!deviceId) return;

    await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    // also try to unsubscribe from browser
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.pushManager) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
    }

    localStorage.removeItem('push_device_id');
  } catch (e) { }
}

export function initVisibilityHandlers(socket) {
  try {
    const emitActive = () => socket && socket.connected && socket.emit('user_active');
    const emitInactive = () => socket && socket.connected && socket.emit('user_inactive');

    const onVisibility = () => {
      if (document.visibilityState === 'visible') emitActive();
      else emitInactive();
    };

    document.addEventListener('visibilitychange', onVisibility);
    // also fire once at init
    onVisibility();

    return () => document.removeEventListener('visibilitychange', onVisibility);
  } catch (e) { return () => { }; }
}

export default { subscribeForPush, unsubscribePush, initVisibilityHandlers };
