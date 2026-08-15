// Privacy-policy consent tracking.
//
// POLICY_VERSION is bumped whenever the policy text changes materially. The
// stored record carries the version it was accepted against, so an old
// acceptance never silently covers new terms — and support can answer "which
// version did this device agree to".
//
// The sign-in screen requires the box to be ticked on every visit rather than
// restoring this record. Sign-in happens once per install (the session token
// persists), so that is a one-time prompt in practice, not a recurring nag.

export const POLICY_VERSION = '2026-08-15';

const KEY = 'ace.privacy.consent';

// Safe wrappers — a WebView with storage disabled must not break sign-in.
function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
}

// getConsent → { version, acceptedAt } | null
export function getConsent() {
  const c = read();
  return c && typeof c.version === 'string' ? c : null;
}

// True only when the stored acceptance matches the policy currently shipping.
export function hasAcceptedCurrent() {
  return getConsent()?.version === POLICY_VERSION;
}

// Called once a sign-in actually succeeds, so a record is never written for an
// attempt the user abandoned.
export function recordConsent() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      version: POLICY_VERSION,
      acceptedAt: new Date().toISOString(),
    }));
  } catch {
    // Storage unavailable — the in-session tick still gated sign-in.
  }
}

export function clearConsent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
