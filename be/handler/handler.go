package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"example.com/config"
	"example.com/realtime"
	"example.com/service"
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
	ai   *service.AIService
	hub  *realtime.Hub
}

func New(cfg *config.Config, auth *service.AuthService, game *service.GameService, ai *service.AIService) *Server {
	hub := realtime.NewHub(realtime.HubConfig{
		WarnSecs:   cfg.AFKWarnSecs,
		GraceSecs:  cfg.AFKGraceSecs,
		MaxRetries: cfg.MaxTurnRetries,
		MinPlayers: cfg.MinPlayers,
		MaxPlayers: cfg.MaxPlayers,
	}, game)
	return &Server{cfg: cfg, auth: auth, game: game, ai: ai, hub: hub}
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

	// WebSocket endpoint for online multiplayer (auth via ?token=).
	mux.HandleFunc("GET /ws", s.handleWS)

	mux.HandleFunc("GET /api/auth/check-username", s.handleCheckUsername)
	mux.HandleFunc("POST /api/auth/send-otp", s.handleSendOTP)
	mux.HandleFunc("POST /api/auth/verify-otp", s.handleVerifyOTP)
	mux.HandleFunc("POST /api/auth/signup", s.handleSignup)
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("POST /api/auth/recover-send-otp", s.handleSendRecoverOTP)
	mux.HandleFunc("POST /api/auth/recover", s.handleRecoverUsername)

	// Public so the web prototype can call it; wrap with authMW + rate-limit before production.
	mux.HandleFunc("POST /api/ai/move", s.handleAIMove)

	mux.HandleFunc("GET /api/admin/sms-config", s.authMW(s.handleGetSMSConfig))
	mux.HandleFunc("PUT /api/admin/sms-config", s.authMW(s.handleSaveSMSConfig))

	mux.HandleFunc("GET /api/me", s.authMW(s.handleMe))
	mux.HandleFunc("GET /api/stats", s.authMW(s.handleStats))
	mux.HandleFunc("DELETE /api/account", s.authMW(s.handleDeleteAccount))
	mux.HandleFunc("POST /api/games", s.authMW(s.handleRecordGame))
	mux.HandleFunc("GET /api/games", s.authMW(s.handleHistory))
}

// CORS echoes back the request's Origin when it's in the configured allow-list
// (a single header can't carry a list), so the web domain and the native
// WebView origin (capacitor://localhost) can both be permitted.
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
