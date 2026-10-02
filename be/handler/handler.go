package handler

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"example.com/config"
	"example.com/realtime"
	"example.com/service"
	"example.com/web"
)

type ctxKey string

const (
	ctxUserID   ctxKey = "uid"
	ctxUsername ctxKey = "un"
)

type Server struct {
	cfg  *config.Config
	auth *service.AuthService
	game *service.GameService
	hub  *realtime.Hub
}

func New(cfg *config.Config, auth *service.AuthService, game *service.GameService) *Server {
	hub := realtime.NewHub(realtime.HubConfig{
		WarnSecs:   cfg.AFKWarnSecs,
		GraceSecs:  cfg.AFKGraceSecs,
		MaxRetries: cfg.MaxTurnRetries,
		MinPlayers: cfg.MinPlayers,
		MaxPlayers: cfg.MaxPlayers,
	}, game)
	return &Server{cfg: cfg, auth: auth, game: game, hub: hub}
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"watch_countdown_secs": s.cfg.WatchCountdownSecs,
			"afk_warn_secs":        s.cfg.AFKWarnSecs,
			"afk_grace_secs":       s.cfg.AFKGraceSecs,
			"max_turn_retries":     s.cfg.MaxTurnRetries,
			"min_players":          s.cfg.MinPlayers,
			"max_players":          s.cfg.MaxPlayers,
			"recent_games_limit":   s.cfg.RecentGamesLimit,
		})
	})

	// Public privacy policy. Play requires a URL readable without installing
	// the app; this serves the same document the in-app screen renders.
	mux.HandleFunc("GET /privacy", web.Privacy)

	// WebSocket endpoint for online multiplayer (auth via ?token=).
	mux.HandleFunc("GET /ws", s.handleWS)

	mux.HandleFunc("GET /api/auth/check-username", s.handleCheckUsername)
	mux.HandleFunc("POST /api/auth/google", s.handleGoogleAuth)
	mux.HandleFunc("POST /api/auth/google/complete", s.handleGoogleComplete)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)

	mux.HandleFunc("GET /api/me", s.authMW(s.handleMe))
	mux.HandleFunc("GET /api/stats", s.authMW(s.handleStats))
	mux.HandleFunc("DELETE /api/account", s.authMW(s.handleDeleteAccount))
	mux.HandleFunc("POST /api/games", s.authMW(s.handleRecordGame))
	mux.HandleFunc("GET /api/games", s.authMW(s.handleHistory))
}

// statusRecorder captures the response code so RequestLog can report it.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Hijack forwards to the underlying writer so the /ws upgrade still works —
// gorilla/websocket type-asserts http.Hijacker, which a plain wrapper hides.
func (r *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("response writer does not support hijacking")
	}
	return h.Hijack()
}

// RequestLog logs one line per HTTP request. Without it a request that never
// arrives is indistinguishable from one that arrived and failed — which is
// exactly the ambiguity that hid a dropped game result.
func RequestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("[http] %s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Millisecond))
	})
}

// CORS echoes back the request's Origin when it's in the configured allow-list
// (a single header can't carry a list), so the web domain and the native
// WebView origin (https://localhost on Android, capacitor://localhost on iOS)
// can both be permitted.
func CORS(cfg *config.Config, next http.Handler) http.Handler {
	wildcard := cfg.OriginAllowed("*")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if wildcard {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" && cfg.OriginAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) authMW(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			writeErr(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		claims, err := s.auth.ParseToken(strings.TrimPrefix(h, "Bearer "))
		if errors.Is(err, service.ErrInvalidToken) {
			writeErr(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserID, claims.UserID)
		ctx = context.WithValue(ctx, ctxUsername, claims.Username)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func userID(r *http.Request) int64    { v, _ := r.Context().Value(ctxUserID).(int64); return v }
func username(r *http.Request) string { v, _ := r.Context().Value(ctxUsername).(string); return v }

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeConflict(w http.ResponseWriter, msg, conflict string) {
	writeJSON(w, http.StatusConflict, map[string]string{"error": msg, "conflict": conflict})
}
