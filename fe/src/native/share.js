// Sharing — the OS share sheet on native, with graceful fallbacks elsewhere.
//
// Android WebViews do not reliably implement navigator.share, so native builds
// go through Capacitor's Share plugin. Everything falls back to the clipboard,
// which is always better than leaving the user with nothing to do.

import { isNative } from './index';

// copyText puts text on the clipboard. Returns true on success.
// The execCommand path is a fallback for WebViews where the async Clipboard API
// is unavailable or blocked; it is deprecated but still the only option there.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// shareText opens the share sheet. Resolves to:
//   'shared'  — handed off to the OS (or the user dismissed the sheet)
//   'copied'  — no share available, text is on the clipboard instead
//   'failed'  — neither worked; the caller should surface the text itself
export async function shareText({ text, title, dialogTitle }) {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle });
      return 'shared';
    } catch {
      // Includes the user cancelling the sheet, which throws on Android. Falling
      // through to the clipboard is harmless in that case.
    }
  } else if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch {}
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
