package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"example.com/service"
)

var usernameRe = regexp.MustCompile(`^[a-z0-9]{3,16}$`)

// ── request / response types ─────────────────────────────────────────────────

type authResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
}

type googleAuthRequest struct {
	IDToken string `json:"id_token"`
}

type googleCompleteRequest struct {
	SignupToken string `json:"signup_token"`
	Username    string `json:"username"`
}

// ── handlers ─────────────────────────────────────────────────────────────────

// GET /api/auth/check-username?username=xxx
func (s *Server) handleCheckUsername(w http.ResponseWriter, r *http.Request) {
	username := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("username")))
	if !usernameRe.MatchString(username) {
		writeErr(w, http.StatusBadRequest, "username must be 3-16 chars: letters and numbers only")
		return
	}
	taken, err := s.auth.CheckUsername(username)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not check username")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"taken": taken})
}

// POST /api/auth/google
// Body: { id_token }. Returns { token, username } for a returning user, or
// { needs_username: true, signup_token } for a first-time Google user.
func (s *Server) handleGoogleAuth(w http.ResponseWriter, r *http.Request) {
	var req googleAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.IDToken) == "" {
		writeErr(w, http.StatusBadRequest, "id_token is required")
		return
	}
	res, err := s.auth.GoogleAuth(r.Context(), req.IDToken)
	if errors.Is(err, service.ErrInvalidToken) {
		writeErr(w, http.StatusUnauthorized, "invalid Google sign-in")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "sign-in failed")
		return
	}
	if res.NeedsUsername {
		writeJSON(w, http.StatusOK, map[string]any{"needs_username": true, "signup_token": res.SignupToken})
		return
	}
	writeJSON(w, http.StatusOK, authResponse{Token: res.Token, Username: res.Username})
}

// POST /api/auth/google/complete
// Body: { signup_token, username }. Creates the account and returns a session.
func (s *Server) handleGoogleComplete(w http.ResponseWriter, r *http.Request) {
	var req googleCompleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	if !usernameRe.MatchString(req.Username) {
		writeErr(w, http.StatusBadRequest, "username must be 3-16 chars: letters and numbers only")
		return
	}
	if req.SignupToken == "" {
		writeErr(w, http.StatusBadRequest, "signup_token is required")
		return
	}
	token, _, err := s.auth.CompleteGoogleSignup(req.SignupToken, req.Username)
	if errors.Is(err, service.ErrInvalidToken) {
		writeErr(w, http.StatusUnauthorized, "sign-in expired — please sign in with Google again")
		return
	}
	if errors.Is(err, service.ErrUsernameTaken) {
		writeConflict(w, "username already taken", "username")
		return
	}
	if errors.Is(err, service.ErrAccountExists) {
		writeConflict(w, "account already registered", "account")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create user")
		return
	}
	writeJSON(w, http.StatusCreated, authResponse{Token: token, Username: req.Username})
}

// POST /api/auth/logout — stateless; the client just discards its token.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "logged out"})
}
