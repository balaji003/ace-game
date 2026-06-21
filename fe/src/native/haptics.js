// Haptic feedback — Capacitor Haptics on native, navigator.vibrate on web.
// All functions are fire-and-forget and safe to call anywhere.

import { isNative } from './index';

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
  if (isNative()) impactStyle('Light');
  else webVibrate(15);
}

// A firmer bump — e.g. a cut / card taken.
export function impact() {
  if (isNative()) impactStyle('Medium');
  else webVibrate(40);
}

// A notification buzz — e.g. win/lose or the no-response prompt.
export async function notify(success = true) {
  if (isNative()) {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: success ? NotificationType.Success : NotificationType.Warning });
    } catch {}
  } else {
    webVibrate(success ? [25, 40, 25] : [60, 50, 60]);
  }
}
