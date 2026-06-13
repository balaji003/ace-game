Stop all ace-game services that were started by the /start command.

Work through each step below using your Bash tool. Report ✅ stopped or ⚪ already stopped for each service.

---

## Step 1 — Vite frontend (port 5173)

Kill whatever process is listening on port 5173:
```
lsof -ti :5173 | xargs kill 2>/dev/null
```
Also clean up the PID file if it exists:
```
rm -f /tmp/ace-fe.pid
```
Confirm the port is free:
```
lsof -ti :5173
```
Report ✅ stopped if the port is now free, ⚪ already stopped if nothing was running.

---

## Step 2 — Go backend (port 8080)

Kill whatever process is listening on port 8080 (go run . spawns child processes, so killing by port is more reliable than by PID):
```
lsof -ti :8080 | xargs kill 2>/dev/null
```
Clean up PID file and compiled binary:
```
rm -f /tmp/ace-be.pid /tmp/ace-be
```
Confirm the port is free:
```
lsof -ti :8080
```
Report ✅ stopped if the port is now free, ⚪ already stopped if nothing was running.

---

## Step 3 — MySQL

Do NOT stop MySQL. It is a system service managed by Homebrew and other apps may depend on it. Report it as 🔒 left running.

---

## Step 4 — Summary

Print a clean status block, for example:
```
✅ Frontend  — stopped (port 5173 free)
✅ Backend   — stopped (port 8080 free)
🔒 MySQL     — left running (system service)
```
