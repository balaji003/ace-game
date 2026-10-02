#!/usr/bin/env bash
#
# Build the ACE web bundle and package it into the Android app.
#
#   ./build-android.sh           → debug APK, installed on a connected device
#   ./build-android.sh release   → signed release AAB for the Play Console
#
# Both modes run the same web build, the same webDir patch and the same Google
# client-ID check. That check matters most on release builds: a missing client
# ID does not fail the build, it just breaks sign-in at runtime — and sign-in is
# the only way into this app.
#
# Requires: Android Studio (for its bundled JDK), node/npm. Debug mode also needs
# a phone with USB debugging enabled (or a running emulator). Release mode needs
# android/keystore.properties (see DEPLOY.md).

set -euo pipefail

MODE="${1:-debug}"
case "$MODE" in
  debug|release) ;;
  *) echo "usage: $0 [debug|release]" >&2; exit 1 ;;
esac

# ── Paths (edit JAVA_HOME/SDK if you move Android Studio) ─────────────────────
FE_DIR="/Users/balajiv/ace-game/fe"
ANDROID_DIR="$FE_DIR/android"
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
AAB="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
APP_ID="com.acegame.app"
WEB_CLIENT_ID="548650148578"   # sanity-check token, must land in the bundle

export JAVA_HOME

echo "==> 1/5  Building web bundle + syncing to Android  [$MODE]"
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

cd "$ANDROID_DIR"

if [ "$MODE" = "release" ]; then
  echo "==> 4/5  Building signed release bundle (clean)"
  if [ ! -f "$ANDROID_DIR/keystore.properties" ]; then
    echo "    ERROR: android/keystore.properties missing." >&2
    echo "    Gradle would emit an UNSIGNED bundle that Play rejects." >&2
    exit 1
  fi
  ./gradlew clean bundleRelease

  echo "==> 5/5  Verifying the bundle is signed"
  if ! "$JAVA_HOME/bin/jarsigner" -verify "$AAB" >/dev/null 2>&1 ; then
    echo "    ERROR: $AAB is not signed." >&2
    exit 1
  fi
  # Self-signed upload keys have no CA chain, so -strict would flag that as an
  # error. Plain -verify is the correct check here.
  "$JAVA_HOME/bin/jarsigner" -verify -verbose:summary -certs "$AAB" 2>/dev/null \
    | grep -m1 "Signed by" || true
  echo
  echo "Done. Upload to the Play Console:"
  echo "  $AAB"
  exit 0
fi

echo "==> 4/5  Building debug APK (clean)"
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
