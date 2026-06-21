# Multi-stage build for the ACE Go backend (HTTP + WebSocket on one port).
# Produces a small static image — the go-sql-driver/mysql driver is pure Go,
# so CGO can be disabled.

# --- build stage ---
FROM golang:1.22-alpine AS build
WORKDIR /src

# Cache deps first
COPY go.mod go.sum ./
RUN go mod download

# Build the static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/ace-be .

# --- runtime stage ---
FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
USER app
WORKDIR /app
COPY --from=build /out/ace-be /app/ace-be

# The backend serves HTTP + WebSocket (/ws) on $PORT (default 8080).
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["/app/ace-be"]
