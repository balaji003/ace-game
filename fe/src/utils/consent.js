// Privacy-policy consent tracking.
//
// The stored record carries the version it was accepted against, so an old
// acceptance never silently covers new terms — and support can answer "which
// version did this device agree to".
//
// The sign-in screen requires the box to be ticked on every visit rather than
// restoring this record. Sign-in happens once per install (the session token
// persists), so that is a one-time prompt in practice, not a recurring nag.

import policyHtml from '../../../be/web/privacy-policy.html?raw';

// The version is declared once, inside the policy markup itself, so editing the
// policy and bumping its version are the same edit and cannot fall out of step.
// If the span ever goes missing the fallback matches no stored record, so every
// device is asked to accept again — the safe direction to fail in.
// be/web/web_test.go asserts the span exists exactly once.
export const POLICY_VERSION =
  /class="ace-policy-version">([^<]+)</.exec(policyHtml)?.[1]?.trim() ?? 'unparsed';

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
