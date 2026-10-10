# Deploying ACE

## Finalised strategy

One **always-on Go container** (server + WebSocket + in-memory rooms in a single process) +
a **managed MySQL**, fronted by **Cloudflare** as a WAF, with **native apps** that talk to it.

There is **no hosted web frontend**. ACE ships as a Capacitor app: the web bundle is packaged
*inside* the APK, so the only thing on the public internet is the API.

```
   Players
   ├─ Android app ─────wss─┐     [ Cloudflare ]          [ Go container ]        [ MySQL ]
   └─ iOS app (later) ─────┘──►  api.playacecard.com ──►  server + websocket ──►  managed DB
                                  WAF + DDoS + TLS         (Railway)              (private)

        Web bundle (fe/dist) is bundled into the app, not hosted
        Apps distributed via Google Play / App Store
```

**Hosts:**

| Piece | Host |
|---|---|
| Go backend container | **Railway** (from `be/Dockerfile`) |
| MySQL database | **Railway** managed MySQL plugin |
| Edge / WAF / DNS | **Cloudflare** (Free plan) — `api.playacecard.com` |
| Domain registrar | **Cloudflare Registrar** — `playacecard.com` |
| Android app | **Google Play** |
| iOS app (later) | **App Store** |

> The apex `playacecard.com` is registered but unused — reserved in case a landing page is
> ever wanted. Only `api.playacecard.com` serves traffic.

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
| `ALLOW_ORIGIN` | **comma-list** of allowed origins (wildcard `*` is refused in prod). Android-only today, so just `https://localhost` — the Android WebView's origin, set by `androidScheme` in `fe/capacitor.config.json`. `capacitor://localhost` is the **iOS** value — add it when iOS ships. |
| `PORT` | `8080` (or the port Railway injects) |
| `JWT_SECRET` | long random string — `openssl rand -base64 48` |
| `DB_USER` / `DB_PASS` / `DB_HOST` / `DB_PORT` / `DB_NAME` | from the Railway MySQL plugin (use its private host) |
| `MIN_PLAYERS` / `MAX_PLAYERS` | `3` / `7` (room size bounds; clamped 2–7) |
| `MAX_TURN_RETRIES` | `3` (no-response "I am here" retries before burn) |
| `AFK_WARN_SECS` / `AFK_GRACE_SECS` | `20` / `10` |
| `WATCH_COUNTDOWN_SECS` / `RECENT_GAMES_LIMIT` | `10` / `10` |
| `GOOGLE_CLIENT_ID` | web OAuth client ID — **required**, startup fails without it |

Full template: [`be/.env.production.example`](be/.env.production.example).

---

## Step-by-step

### 1. Backend + MySQL on Railway

This repo is a **monorepo** (`be/` + `fe/`), but no restructuring is needed — Railway treats it as an
[isolated monorepo](https://docs.railway.com/deployments/monorepo): you point the backend service at the
`be/` subdirectory and it deploys only that. All Railway config lives in the **dashboard** (no `railway.toml`
in the repo) — the two settings that matter for a monorepo (Root Directory, Watch Paths) are dashboard-only
anyway, and [`be/Dockerfile`](be/Dockerfile) already pins the build.

Backend service **Settings** to set:

| Setting | Value | Why |
|---|---|---|
| **Root Directory** | `be` | Scopes the build to `be/` and makes [`be/Dockerfile`](be/Dockerfile) the detected builder. `be/` is self-contained (its own `go.mod`), so the Docker build context is correct. |
| **Watch Paths** | `/be/**` | Only pushes touching `be/` trigger a backend redeploy — so `fe/`-only or `DEPLOY.md` commits don't waste a rebuild. |
| **Healthcheck Path** | `/health` | The backend already serves `/health`; Railway waits for it before routing traffic. |

Steps:
1. Push the repo to GitHub.
2. **Railway → New Project → Deploy from GitHub repo.** In the service **Settings**, apply the table above
   (Root Directory `be`, Watch Paths `/be/**`, Healthcheck Path `/health`).
3. **+ New → Database → MySQL.** Railway provisions a managed MySQL.
4. In the backend service **Variables**, set everything from the table above. For `DB_*`, use the MySQL
   plugin's **private** connection vars (Railway exposes them as references).
5. Deploy. The generated `*.up.railway.app` URL is **temporary** — it is deleted in §2 once the
   custom domain works, so that the WAF cannot be bypassed.
6. **Apply the schema once** against the Railway MySQL (via Railway's DB "Connect" or the `mysql` CLI):
   run [`be/schema.sql`](be/schema.sql) then each file in [`be/migrations/`](be/migrations/) in order.
7. Health check: `curl -sf https://api.playacecard.com/health` → `{"status":"ok"}`.

### 2. Domain + Cloudflare WAF

Railway has no WAF, so Cloudflare proxies the API. Everything below is on the **Free** plan —
the only recurring cost is the domain (~$10/yr).

**Order matters.** Railway cannot validate the domain or issue its TLS certificate *through*
the Cloudflare proxy, so this is two passes:

1. **Railway → service → Settings → Networking → Custom Domain** → add `api.playacecard.com`.
   Railway's "One-click DNS Setup" writes the CNAME into Cloudflare for you.
2. Leave the record **DNS only (grey cloud)** until Railway reports the certificate issued
   (minutes, up to an hour). Verify: `curl -sf https://api.playacecard.com/health`.
3. **Cloudflare → SSL/TLS → Overview → `Full`** — **not Full (strict)**. Once proxied, Railway
   answers with its default `*.up.railway.app` certificate, which does not match the hostname,
   so strict validation fails.
4. **Cloudflare → DNS** → edit the `api` record → **Proxied (orange cloud)**. Nothing is
   protected until this flip; grey cloud bypasses every rule.
5. **Cloudflare → Security → Settings** → deploy the **Cloudflare Free Managed Ruleset** (Block).
6. **Cloudflare → Security → Security rules** → custom rules (5 available on Free):
   ```
   # "Block unknown paths" → Block
   not ( http.request.uri.path eq "/health" or
         http.request.uri.path eq "/privacy" or
         http.request.uri.path eq "/ws" or
         starts_with(http.request.uri.path, "/api/") )

   # "Block unexpected methods" → Block
   not http.request.method in {"GET" "POST" "DELETE" "OPTIONS"}
   ```
7. **Security rules → Rate limiting rule** (1 on Free, path field only, 10s max window):
   path `eq "/api/auth/google"`, 10 requests / 10 seconds, action Block.
8. **SSL/TLS → Edge Certificates** → **Always Use HTTPS** + **HSTS** (6 months, no preload).
9. Test a real two-device match, then **delete the generated `*.up.railway.app` domain** in
   Railway. That is what makes the WAF unavoidable rather than optional.

> **Do not enable Bot Fight Mode**, and never use Managed/JS Challenge actions on `/api/*`
> or `/ws`. Challenges require solving JavaScript, which the Capacitor WebView cannot do on a
> `fetch()` call — it would break sign-in and gameplay for every native user while a browser
> test still looks fine. Use **Block** actions only.

> **Free plan ceilings:** 1 rate limiting rule (path only, 10s window), 5 custom rules, the
> Free Managed Ruleset only. Volume is unmetered. The binding limit is the 10-second window,
> which cannot catch slow credential stuffing — the fix is per-IP rate limiting in Go, not a
> Pro upgrade.

**Dashboard note:** Cloudflare's redesigned security dashboard has **no "WAF" menu item**.
Managed rulesets and bot settings are under **Security → Settings**; custom and rate limiting
rules under **Security → Security rules**; blocked requests under **Security → Analytics**.

### 3. Android app (Google Play)
The app loads a **bundled** copy of the web build and calls the **remote** backend, so it needs the
backend URL baked in at build time.
1. The prod URLs live in [`fe/.env.production`](fe/.env.production), which Vite auto-loads for
   production builds — that file is the source of truth, and it overrides the
   `NATIVE_API_DEFAULT`/`NATIVE_WS_DEFAULT` fallbacks in [`fe/src/config.js`](fe/src/config.js).
   Keep both in sync; the fallbacks only apply if the env vars are somehow unset.
   ```
   VITE_API_URL=https://api.playacecard.com
   VITE_WS_URL=wss://api.playacecard.com
   ```
   To override for a one-off build:
   ```bash
   cd fe
   VITE_APP_ENV=production VITE_API_URL=https://api.playacecard.com \
   VITE_WS_URL=wss://api.playacecard.com npm run build:native
   ```
2. Build the signed release bundle. The script runs the web build, the webDir patch and the
   Google client-ID check, then refuses to finish if the result is unsigned:
   ```bash
   cd fe && ./build-android.sh release
   # → fe/android/app/build/outputs/bundle/release/app-release.aab
   ```
3. Bump `versionCode` in [`fe/android/app/build.gradle`](fe/android/app/build.gradle) for **every**
   upload — Play rejects a reused value.
4. Upload the AAB to the **Play Console**.
5. Ensure `ALLOW_ORIGIN` on the backend includes **`https://localhost`** (the Android WebView's origin) — else
   every API call fails CORS while the app otherwise looks fine.

#### Signing
Credentials live in `fe/android/keystore.properties`, which points at the upload keystore. Both are
gitignored and **must be backed up off this machine** — losing them means the app can never be updated
under the same Play listing.

| What | Where |
|---|---|
| Upload keystore | `~/ace-upload-key.jks` (outside the repo) |
| Credentials | `fe/android/keystore.properties` |
| Key alias | `ace-upload` (RSA 2048, valid to Feb 2054) |

Print the upload key's SHA-1 at any time:
```bash
keytool -list -v -keystore ~/ace-upload-key.jks -alias ace-upload \
  | grep SHA1:   # password is in fe/android/keystore.properties
```

#### Privacy policy URL (required by Play)
Play needs a policy readable on the open web, without installing the app. There is no hosted web
frontend, so the Go backend serves it at **`https://api.playacecard.com/privacy`** — use that as
the listing's privacy policy URL. Cloudflare custom rule 1 explicitly allows `/privacy`; if that
rule is ever tightened, this URL must stay reachable or Play will flag the listing.

There is only ever one copy of the text. [`be/web/privacy-policy.html`](be/web/privacy-policy.html)
and its stylesheet are embedded into the Go binary (`go:embed`) **and** raw-imported by the in-app
screen at build time, so the public page and the in-app page are the same document and cannot drift.
The policy version lives in that markup too, and `fe/src/utils/consent.js` parses it from there —
editing the policy and bumping its version are a single edit.

Because the text is inlined into the JS bundle, the in-app policy also works **offline**, which
matters: consent is required before sign-in, when no session yet exists.

> **Contact address:** `acegametn@gmail.com`, set in
> [`be/web/privacy-policy.html`](be/web/privacy-policy.html). It is named as the contact for
> deletion and data-access requests, so it must stay monitored. Use the same address in the Play
> listing's contact details.

#### Google Sign-In fingerprints — do not skip
Google Identity matches the app by **package name + signing-certificate SHA-1**. Play App Signing
strips the upload signature and re-signs with its own key, so the installed app presents a fingerprint
that never existed locally. Google is the only auth path in this app, so a mismatch makes the app
unusable for every install (`DEVELOPER_ERROR` at sign-in).

Register **both** fingerprints on the Android OAuth client for `com.acegame.app` in Google Cloud Console:
1. the **upload key** SHA-1 (command above), and
2. the **app signing key** SHA-1 from Play Console → *Test and release → App integrity* — this only
   exists after the first AAB upload, so register it immediately afterwards and before any public test.

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
