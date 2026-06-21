# Deploying ACE

## Finalised strategy

One **always-on Go container** (server + WebSocket + in-memory rooms in a single process) +
a **managed MySQL** + a **static web frontend** on a CDN + **native apps** that talk to the same backend.

```
   Players
   ├─ Web browser ─────────┐
   ├─ Android app ─────wss─┤►  [ Go container ]  ──private──►  [ MySQL ]
   └─ iOS app (later) ─────┘    server + websocket              managed DB
                                       │
        Web bundle (fe/dist) served by Cloudflare Pages (free global CDN)
        Apps distributed via Google Play / App Store (not "hosted" — just call the backend)
```

**Hosts (Option B — recommended):**

| Piece | Host |
|---|---|
| Go backend container | **Railway** (from `be/Dockerfile`) |
| MySQL database | **Railway** managed MySQL plugin |
| Web frontend (`fe/dist/`) | **Cloudflare Pages** (free, global CDN, auto-deploy from GitHub) |
| Android app | **Google Play** |
| iOS app (later) | **App Store** |

> **Option A (all-in-one):** also serve the web bundle from Railway as a static service — one dashboard,
> but no global CDN and it uses container resources. Prefer Option B unless you want fewer accounts.

> **Why not serverless (AWS API Gateway WS + Lambda)?** ACE keeps rooms/timers **in memory in one
> process**; serverless can't, and would force rewriting state into DynamoDB. Wrong tool for a stateful
> turn-based game. Railway/Render/Fly.io are the EC2/ECS-equivalent hosts we want.

**Scaling:** run a **single** backend instance (rooms are in-memory). Scale **vertically** (bigger
instance) first; only move to multiple instances with Redis-backed rooms when one box isn't enough.
A turn-based game handles thousands of players on one small instance (~10k connections/GB).

---

## Backend env vars (set in Railway → service → Variables)

| Var | Value |
|-----|-------|
| `APP_ENV` | `prod` |
| `ALLOW_ORIGIN` | **comma-list** of allowed origins: web domain **+ the native WebView origin**, e.g. `https://ace.pages.dev,capacitor://localhost` (wildcard `*` is refused in prod) |
| `PORT` | `8080` (or the port Railway injects) |
| `JWT_SECRET` | long random string — `openssl rand -base64 48` |
| `DB_USER` / `DB_PASS` / `DB_HOST` / `DB_PORT` / `DB_NAME` | from the Railway MySQL plugin (use its private host) |
| `MIN_PLAYERS` / `MAX_PLAYERS` | `3` / `7` (room size bounds; clamped 2–7) |
| `MAX_TURN_RETRIES` | `3` (no-response "I am here" retries before burn) |
| `AFK_WARN_SECS` / `AFK_GRACE_SECS` | `20` / `10` |
| `WATCH_COUNTDOWN_SECS` / `RECENT_GAMES_LIMIT` | `10` / `10` |
| `OTP_MAX_PER_DAY` / `OTP_COOLDOWN_SECS` | `5` / `30` |
| `ANTHROPIC_API_KEY` / `AI_MODEL` | optional — Smart AI opponents |

Full template: [`be/.env.production.example`](be/.env.production.example).

---

## Step-by-step

### 1. Backend + MySQL on Railway
1. Push the repo to GitHub.
2. **Railway → New Project → Deploy from GitHub repo.** Set the service **root directory** to `be/`
   (it builds from [`be/Dockerfile`](be/Dockerfile)).
3. **+ New → Database → MySQL.** Railway provisions a managed MySQL.
4. In the backend service **Variables**, set everything from the table above. For `DB_*`, use the MySQL
   plugin's **private** connection vars (Railway exposes them as references).
5. Deploy. Note the public backend URL, e.g. `https://ace-be.up.railway.app`.
6. **Apply the schema once** against the Railway MySQL (via Railway's DB "Connect" or the `mysql` CLI):
   run [`be/schema.sql`](be/schema.sql) then each file in [`be/migrations/`](be/migrations/) in order.
7. Health check: `curl -sf https://ace-be.up.railway.app/health` → `{"status":"ok"}`.

### 2. Web frontend on Cloudflare Pages
1. **Cloudflare Pages → Create → Connect to Git**, pick the repo.
2. Build settings: **root** `fe`, **build command** `npm run build`, **output** `dist`.
3. Environment variables (Production):
   ```
   VITE_APP_ENV = production
   VITE_API_URL = https://ace-be.up.railway.app
   VITE_WS_URL  = wss://ace-be.up.railway.app
   ```
4. Deploy → note the web URL, e.g. `https://ace.pages.dev`.
5. Back on Railway, set `ALLOW_ORIGIN = https://ace.pages.dev,capacitor://localhost` and redeploy.
6. Open the web URL on two devices, log in as two users, **Play Online** → match → play.

### 3. Android app (Google Play)
The app loads a **bundled** copy of the web build and calls the **remote** backend, so it needs the
backend URL baked in at build time.
1. Build the web bundle pointing at prod and sync it into the native project:
   ```bash
   cd fe
   VITE_APP_ENV=production VITE_API_URL=https://ace-be.up.railway.app \
   VITE_WS_URL=wss://ace-be.up.railway.app npm run build:native
   ```
   (or set `NATIVE_API_DEFAULT`/`NATIVE_WS_DEFAULT` in [`fe/src/config.js`](fe/src/config.js)).
2. Open `fe/android/` in **Android Studio** → set app id/version → **Build → Generate Signed Bundle (AAB)**.
3. Upload the AAB to the **Play Console**.
4. Ensure `ALLOW_ORIGIN` on the backend includes **`capacitor://localhost`** (the WebView's origin) — else
   the app can't connect.

### 4. iOS app (later — build-only)
`cd fe && npm i @capacitor/ios && npx cap add ios && npx cap sync` → open `fe/ios/` in Xcode → set
signing + Info.plist → Archive → upload to App Store Connect. **No web/React code changes** — every
native call already routes through `fe/src/native/`. (Also add `capacitor://localhost` for iOS's WebView.)

---

## Going beyond Railway's MySQL (when needed)
Railway's MySQL is a single-node managed instance — great for launch, but not HA/PITR-grade. If you need
that, keep the Go container on Railway and point `DB_*` at **PlanetScale** (serverless MySQL) or **AWS RDS**.
No app code changes — just env vars.

## Local Docker sanity check
```bash
cd be
docker build -t ace-be .
docker run --rm -p 8080:8080 \
  -e APP_ENV=dev -e JWT_SECRET=dev-secret \
  -e DB_HOST=host.docker.internal -e DB_USER=aceuser -e DB_PASS='ace@52' -e DB_NAME=ace \
  ace-be
# then: curl -sf http://localhost:8080/health
```
