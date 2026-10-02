import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PrivacyPolicy from './screens/PrivacyPolicy';

// Google Play requires a privacy policy reachable on the open web — a reviewer
// or a user browsing the store listing must be able to read it without
// installing the app. /privacy renders the same component the sign-in screen
// shows, so the two can never drift apart.
//
// The host must serve index.html for this path (SPA fallback); see
// public/_redirects for the Cloudflare Pages rule.
const path = typeof window !== 'undefined'
  ? window.location.pathname.replace(/\/+$/, '')
  : '';
const isPolicyRoute = path === '/privacy';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPolicyRoute
      ? <PrivacyPolicy onBack={() => { window.location.href = '/'; }} />
      : <App />}
  </StrictMode>
);
