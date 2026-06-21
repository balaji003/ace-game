import { isNative } from './native';

// Environment flag — 'development' | 'production' (Vite sets MODE per build).
export const ENV     = import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE;
export const IS_PROD = ENV === 'production';

// API/WS bases.
// Web/dev: derive from the page host so any device on the same WiFi auto-targets
//   the host machine's backend (LAN multiplayer testing); upgrades to https/wss on TLS.
// Native: window.location is the bundled app (capacitor://localhost), NOT the
//   backend — so the URL must be baked at build time via VITE_API_URL/VITE_WS_URL.
const native = isNative();
const secure = !native && typeof window !== 'undefined' && window.location.protocol === 'https:';
const host   = (!native && typeof window !== 'undefined') ? window.location.hostname : 'localhost';

// Fallback prod endpoints for native builds that forget to set the env vars.
// TODO: replace with your real deployed domain before shipping the app.
const NATIVE_API_DEFAULT = 'https://api.yourgame.com';
const NATIVE_WS_DEFAULT  = 'wss://api.yourgame.com';

export const API_BASE = import.meta.env.VITE_API_URL
  ?? (native ? NATIVE_API_DEFAULT : `${secure ? 'https' : 'http'}://${host}:8080`);

export const WS_BASE = (import.meta.env.VITE_WS_URL
  ?? (native ? NATIVE_WS_DEFAULT : `${secure ? 'wss' : 'ws'}://${host}:8080`)) + '/ws';

export const AI_ENABLED = true;
