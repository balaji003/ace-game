// Google Sign-In, one interface over two backends:
//   web    → Google Identity Services (GIS), rendered as Google's own button
//   native → @capgo/capacitor-social-login (GIS is blocked in WebViews)
// Both yield a Google ID token that the backend verifies at POST /api/auth/google.

import { isNative } from './index';
import { GOOGLE_CLIENT_ID } from '../config';

// ── Web: Google Identity Services ────────────────────────────────────────────
let gisPromise = null;

function loadGIS() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

// Render the official Google button into `el`. `onCredential(idToken)` fires on
// success; `onError(err)` on load/config failure.
export async function renderGoogleButton(el, onCredential, onError) {
  try {
    const google = await loadGIS();
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: ({ credential }) => onCredential(credential),
    });
    el.innerHTML = '';
    google.accounts.id.renderButton(el, {
      theme: 'filled_blue', size: 'large', shape: 'pill',
      text: 'continue_with', width: 280,
    });
  } catch (e) {
    onError?.(e);
  }
}

// ── Native: Capacitor Social Login plugin ────────────────────────────────────
let nativeInited = false;

export async function nativeGoogleSignIn() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!nativeInited) {
    // On Android the web client ID is the serverClientId, so the returned ID
    // token's audience matches GOOGLE_CLIENT_ID on the backend.
    await SocialLogin.initialize({ google: { webClientId: GOOGLE_CLIENT_ID } });
    nativeInited = true;
  }
  const res = await SocialLogin.login({ provider: 'google' });
  const idToken = res?.result?.idToken;
  if (!idToken) throw new Error('No Google credential returned');
  return idToken;
}

export { isNative };
