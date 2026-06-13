Start all ace-game services: MySQL, Go backend, and Vite frontend.

Work through each step below using your Bash tool. Report ✅ or ❌ for each service at the end.

---

## Step 1 — MySQL (port 3306)

Check if MySQL is already accepting connections:
```
mysql -u aceuser -p'ace@52' -h localhost ace -e "SELECT 1" 2>/dev/null
```
- If the command succeeds → report already running, skip to Step 2.
- If it fails → run `brew services start mysql`, then retry the check every 2 seconds up to 5 times. If it never comes up, report ❌ and continue anyway.

---

## Step 2 — Go backend (port 8080)

Check if the backend is already up:
```
curl -sf http://localhost:8080/health
```
- If it returns a response → kill it (`lsof -ti :8080 | xargs kill -9`) so we can restart with a fresh binary.
- Always rebuild and restart:
```
cd /Users/balajiv/ace-game/be && export $(grep -v '^#' .env | xargs) && go build -o /tmp/ace-be . && /tmp/ace-be > /tmp/ace-be.log 2>&1 &
echo $! > /tmp/ace-be.pid
```
Always rebuilds to pick up any code changes since last start. Poll `curl -sf http://localhost:8080/health` every 2 seconds up to 8 times. Report ✅ when it responds, ❌ if it never does. On failure show the last 10 lines of `/tmp/ace-be.log`.

---

## Step 3 — Vite frontend (port 5173)

Check if the frontend is already running:
```
lsof -ti :5173
```
- If a PID is returned → report already running, skip to Step 4.
- If not → start it in the background:
```
(cd /Users/balajiv/ace-game/fe && npm run dev) > /tmp/ace-fe.log 2>&1 &
echo $! > /tmp/ace-fe.pid
```
Then wait 4 seconds and check `lsof -ti :5173` again to confirm. Report ✅ if listening, ❌ if not. On failure, show the last 10 lines of `/tmp/ace-fe.log`.

---

## Step 4 — Summary

Print a clean status block, for example:
```
✅ MySQL     — localhost:3306
✅ Backend   — http://localhost:8080
✅ Frontend  — http://localhost:5173
```
If everything is green, remind the user to open http://localhost:5173 in their browser.
