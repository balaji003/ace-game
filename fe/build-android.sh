#!/usr/bin/env bash
#
# Build the ACE web bundle, package it into the Android APK, and install it on a
# connected device. Run from anywhere:  ./build-android.sh
#
# Requires: Android Studio (for its bundled JDK), node/npm, a phone with USB
# debugging enabled (or a running emulator).

set -euo pipefail

# ── Paths (edit JAVA_HOME/SDK if you move Android Studio) ─────────────────────
FE_DIR="/Users/balajiv/ace-game/fe"
ANDROID_DIR="$FE_DIR/android"
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APP_ID="com.acegame.app"
WEB_CLIENT_ID="548650148578"   # sanity-check token, must land in the bundle

export JAVA_HOME

echo "==> 1/5  Building web bundle + syncing to Android"
cd "$FE_DIR"
npm run build:native

echo "==> 2/5  Patching webDir (dist -> public) in synced Capacitor config"
sed -i '' 's/"webDir": "dist"/"webDir": "public"/g' \
  "$ANDROID_DIR/app/src/main/assets/capacitor.config.json"

echo "==> 3/5  Verifying Google client ID made it into the bundle"
if grep -rql "$WEB_CLIENT_ID" "$ANDROID_DIR/app/src/main/assets/public/" ; then
  echo "    OK: client id found in bundle"
else
  echo "    ERROR: client id MISSING from bundle — check fe/.env.production" >&2
  exit 1
fi

echo "==> 4/5  Building debug APK (clean)"
cd "$ANDROID_DIR"
./gradlew clean assembleDebug

echo "==> 5/5  Installing on device"
if ! "$ADB" get-state >/dev/null 2>&1 ; then
  echo "    ERROR: no device/emulator detected by adb." >&2
  echo "    Plug in the phone (USB debugging on) or start an emulator, then re-run." >&2
  exit 1
fi
"$ADB" uninstall "$APP_ID" >/dev/null 2>&1 || true
"$ADB" install "$APK"

echo
echo "Done. Reopen ACE on the phone."
