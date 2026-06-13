# ACE Backend — single file (Go + MySQL)

Everything is in `main.go` (one `package main`). Module is `example.com`.

## Run
```bash
# 1. database
mysql -u root -p < schema.sql

# 2. config
cp .env.example .env            # set DB_PASS, JWT_SECRET, ANTHROPIC_API_KEY
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
| POST | `/api/ai/move` | no* | game state → `{index, card, usedAI}` |

\* `/api/ai/move` is public so the web prototype can call it. Wrap it with
`s.authMW(...)` and add rate limiting before production (it spends Anthropic quota).

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
Set `API_BASE = "http://localhost:8080"` at the top of `ace-game.jsx`. With **Smart AI**
selected, opponent turns call `POST /api/ai/move`.
