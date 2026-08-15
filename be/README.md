# ACE Backend — single file (Go + MySQL)

Everything is in `main.go` (one `package main`). Module is `example.com`.

## Run
```bash
# 1. database
mysql -u root -p < schema.sql

# 2. config
cp .env.example .env            # set DB_PASS, JWT_SECRET, GOOGLE_CLIENT_ID
export $(grep -v '^#' .env | xargs)

# 3. deps + run
go mod tidy
go run .
```
Server listens on `:8080`.

## Endpoints
| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/health` | no | — |
| POST | `/api/auth/signup` | no | `{username, pin}` |
| POST | `/api/auth/login` | no | `{username, pin}` |
| POST | `/api/auth/logout` | no | — |
| GET | `/api/me` | yes | — |
| GET | `/api/stats` | yes | — |
| DELETE | `/api/account` | yes | — |
| POST | `/api/games` | yes | `{won, placement, mode, opponents[]}` |
| GET | `/api/games?limit=50` | yes | — |

Protected routes need `Authorization: Bearer <token>` from signup/login.

## Quick test
```bash
TOKEN=$(curl -s localhost:8080/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"ravi","pin":"4821"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')

curl -s localhost:8080/api/games \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"won":true,"placement":1,"mode":"vs AI","opponents":["Alex","Sam","Jordan"]}'
```

## Frontend
Point the frontend at this server with `VITE_API_URL` / `VITE_WS_URL` in `fe/.env`.
Single-player opponents run entirely in the browser (`fe/src/game/ai.js`) — the
backend is only involved in auth, stats, history, and online multiplayer.
