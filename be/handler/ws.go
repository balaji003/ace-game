package handler

import (
	"net/http"

	"github.com/gorilla/websocket"
)

// upgrader enforces the env-dependent origin policy:
//   dev  → accept any origin (LAN devices, localhost, etc.)
//   prod → only the configured ALLOW_ORIGIN.
func (s *Server) upgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			if !s.cfg.IsProd() {
				return true
			}
			// Native WebViews send no Origin header → allow (the JWT still gates access).
			origin := r.Header.Get("Origin")
			return origin == "" || s.cfg.OriginAllowed(origin)
		},
	}
}

// handleWS authenticates via the ?token= query param (the browser WebSocket API
// can't set an Authorization header), upgrades the connection, and hands it to
// the hub. The hub blocks serving the socket until it closes.
func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		writeErr(w, http.StatusUnauthorized, "missing token")
		return
	}
	claims, err := s.auth.ParseToken(token)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}

	up := s.upgrader()
	conn, err := up.Upgrade(w, r, nil)
	if err != nil {
		return // Upgrade already wrote the HTTP error response
	}
	s.hub.Handle(conn, claims.UserID, claims.Username)
}
