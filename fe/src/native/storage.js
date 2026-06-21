// Token storage that is secure on native and localStorage on web.
//
// Callers (api.js) read the token synchronously while building requests, but
// Capacitor Preferences is async — so we hydrate an in-memory cache once at
// boot (hydrateToken) and serve sync reads from it, writing through to the
// backing store on set/clear.

import { isNative } from './index';

const TOKEN_KEY = 'ace_token';
let cached = null;
let prefs = null; // lazily-loaded @capacitor/preferences on native

async function getPrefs() {
  if (!prefs) ({ Preferences: prefs } = await import('@capacitor/preferences'));
  return prefs;
}

// Load the persisted token into memory. Call once before the first authed call.
export async function hydrateToken() {
  if (isNative()) {
    try {
      const { value } = await (await getPrefs()).get({ key: TOKEN_KEY });
      cached = value || null;
    } catch {
      cached = null;
    }
  } else {
    cached = localStorage.getItem(TOKEN_KEY);
  }
  return cached;
}

export function getToken() { return cached; }

export function setToken(token) {
  cached = token;
  if (isNative()) {
    getPrefs().then(p => p.set({ key: TOKEN_KEY, value: token })).catch(() => {});
  } else {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  }
}

export function clearToken() {
  cached = null;
  if (isNative()) {
    getPrefs().then(p => p.remove({ key: TOKEN_KEY })).catch(() => {});
  } else {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }
}
