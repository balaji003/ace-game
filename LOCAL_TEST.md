# Local testing guide

How to run ACE locally, test it on a phone over WiFi, and build/install the Android APK.

---

## 1. Start everything — `/start-app`

In Claude Code, run:

```
/start-app
```

It starts all three services and reports status. To stop them later: `/stop-app`
(leaves MySQL running, since it's a shared system service).

### Running ports

| Service  | URL / Port | Notes |
|----------|------------|-------|
| **MySQL**    | `localhost:3306` | db `ace`, user `aceuser` (system service via Homebrew) |
| **Backend (Go)** | `http://localhost:8080` | REST + WebSocket (`/ws`); health: `/health` |
| **Frontend (Vite)** | `http://localhost:5173` | the web app |
| **Frontend on LAN** | `http://192.168.29.33:5173` | open this on other devices on the same WiFi |

> The LAN IP (`192.168.29.33`) can change between sessions. Find the current one with:
> `ipconfig getifaddr en0`

### Manual equivalent (if not using `/start-app`)

```bash
# MySQL (if not already running)
brew services start mysql

# Backend
cd be && export $(grep -v '^#' .env | xargs) && go build -o /tmp/ace-be . && /tmp/ace-be

# Frontend (separate terminal)
cd fe && npm run dev
```

---

## 2. Quick mobile test — phone browser over WiFi (no APK needed)

Fastest way to test on a real phone. The web app auto-detects the host, so it just works.

1. Phone and Mac on the **same WiFi**.
2. On the phone browser, open **`http://192.168.29.33:5173`**.
3. Log in. For a 2-player online match you need two different accounts — use a second device,
   or a normal + incognito window on the laptop.
4. **Test accounts:** signup needs a phone OTP; in dev it's printed to the backend log —
   read it with `tail -f /tmp/ace-be.log`.

This path needs no Android build and no cleartext config — recommended for day-to-day testing.

---

## 3. Build the Android APK

**Prerequisite (one-time):** install **Android Studio** (bundles the Android SDK + JDK). This machine
currently has no SDK (`ANDROID_HOME` unset, no `adb`), so the APK can't be built from the CLI until that's
installed.

The native app bundles the web build and calls a **remote** backend, so the backend URL must be baked in
at build time. For local testing, point it at the Mac's **LAN IP** (a phone can't reach the Mac's
`localhost`).

### 3a. Build the web bundle for the LAN backend + sync into Android

```bash
cd fe
VITE_API_URL=http://192.168.29.33:8080 \
VITE_WS_URL=ws://192.168.29.33:8080 \
npm run build:native        # = vite build && cap sync
```

### 3b. Allow cleartext (local only — LAN is http/ws, not https/wss)

Android blocks plain `http`/`ws` by default. For local testing, add `usesCleartextTraffic` to
`fe/android/app/src/main/AndroidManifest.xml` on the `<application>` tag:

```xml
<application
    android:usesCleartextTraffic="true"
    ... >
```

> Remove this for a release build — production uses `https`/`wss`, which needs no cleartext.

### 3c. Build the APK

**Option A — Android Studio (recommended):**
1. `npx cap open android` (opens the project in Android Studio).
2. Plug in a phone (USB debugging on) or start an emulator.
3. **Run ▶** to install & launch, or **Build → Build APK(s)** to produce a debug APK.

**Option B — command line (needs `ANDROID_HOME` set):**
```bash
cd fe/android
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. Install & test on the phone

1. Make sure the **backend and frontend are running** (`/start-app`) and the phone is on the **same WiFi**.
2. Install the APK:
   - Android Studio **Run ▶** installs automatically, **or**
   - `adb install app/build/outputs/apk/debug/app-debug.apk`, **or**
   - copy the `.apk` to the phone and tap it (allow "install from unknown sources").
3. Open the **ACE** app → it loads the bundled UI and connects to `http://192.168.29.33:8080`.
4. Verify: splash screen, safe-area (no notch overlap), log in (session persists after relaunch),
   haptics/sound on your turn, and an online match against the laptop/another phone.

### Emulator note
An Android emulator can't reach the Mac's LAN IP; use the host alias **`10.0.2.2`** instead:
build with `VITE_API_URL=http://10.0.2.2:8080 VITE_WS_URL=ws://10.0.2.2:8080`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App loads but can't log in / "connection error" | Backend not running, wrong LAN IP baked in, or cleartext not enabled (step 3b). |
| Phone browser can't open `:5173` | Not on the same WiFi, or Vite not started with LAN host (it is, via `server.host`). |
| WebSocket won't connect on device | Confirm backend reachable: open `http://192.168.29.33:8080/health` in the phone browser. |
| OTP never arrives | Dev uses log-based SMS — read the code from `tail -f /tmp/ace-be.log`. |
| LAN IP changed | Re-run `ipconfig getifaddr en0`, rebuild the bundle (step 3a) with the new IP. |
