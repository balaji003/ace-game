// Haptic feedback — Capacitor Haptics on native, navigator.vibrate on web.
// All functions are fire-and-forget and safe to call anywhere.
//
// Honors a persisted on/off flag, mirroring the mute flag in sound.js so the
// settings panel can treat the two the same way. Defaults to ON: absence of a
// stored value means the user has never chosen, not that they opted out.

import { isNative } from './index';

const ENABLED_KEY = 'ace_haptics';

let enabled = (() => {
  try {
    // Only an explicit stored opt-out turns this off. A missing key, or any
    // unexpected value, means the user has never chosen — so default to on.
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true; // storage blocked (private mode, cleared data) — still buzz
  }
})();

export const isEnabled = () => enabled;

export function setEnabled(v) {
  enabled = !!v;
  try { localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0'); } catch {}
}

async function impactStyle(style) {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle[style] });
  } catch {}
}

function webVibrate(ms) {
  try { navigator.vibrate?.(ms); } catch {}
}

// A light tick — e.g. on your turn starting.
export function tap() {
  if (!enabled) return;
  if (isNative()) impactStyle('Light');
  else webVibrate(15);
}

// A firmer bump — e.g. a cut / card taken.
export function impact() {
  if (!enabled) return;
  if (isNative()) impactStyle('Medium');
  else webVibrate(40);
}

// A notification buzz — e.g. win/lose or the no-response prompt.
export async function notify(success = true) {
  if (!enabled) return;
  if (isNative()) {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: success ? NotificationType.Success : NotificationType.Warning });
    } catch {}
  } else {
    webVibrate(success ? [25, 40, 25] : [60, 50, 60]);
  }
}
