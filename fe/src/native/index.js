// Native abstraction layer.
//
// This is the single boundary between the React app and any platform-native
// capability. Everything here uses Capacitor's cross-platform plugins with web
// fallbacks, so the SAME code runs in a browser, Android, and (later) iOS with
// no changes — adding iOS is a build step, not a code change.

import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

// initNativeShell wires the one-time native chrome: splash, status bar, app
// lifecycle (background→resume) and the Android hardware back button. No-op on
// web. `handlers` lets the app hook resume/back without importing plugins.
//   handlers.onResume() — app returned to foreground
//   handlers.onBack()   — Android back pressed; return true if handled
export async function initNativeShell(handlers = {}) {
  if (!isNative()) return;

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const { App } = await import('@capacitor/app');

    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: '#0a2e1c' }).catch(() => {});
    await SplashScreen.hide().catch(() => {});

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) handlers.onResume?.();
    });

    App.addListener('backButton', ({ canGoBack }) => {
      const handled = handlers.onBack?.();
      if (!handled && !canGoBack) App.exitApp();
    });
  } catch (e) {
    console.warn('native shell init failed', e);
  }
}
