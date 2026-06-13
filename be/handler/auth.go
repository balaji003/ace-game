package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"example.com/service"
)

var (
	usernameRe = regexp.MustCompile(`^[a-z0-9]{3,16}$`)
	phoneRe    = regexp.MustCompile(`^[0-9]{10}$`)
	pinRe      = regexp.MustCompile(`^[0-9]{4}$`)
)

func normalizePhone(p string) string {
	var b strings.Builder
	for _, r := range p {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func validPhone(p string) bool { return phoneRe.MatchString(p) }

// ── request / response types ─────────────────────────────────────────────────

type authResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
}

type signupRequest struct {
	Username   string `json:"username"`
	Pin        string `json:"pin"`
	PhoneToken string `json:"phone_token"` // short-lived JWT from verify-otp
}

type loginRequest struct {
	Username string `json:"username"`
	Pin      string `json:"pin"`
}

type sendOTPRequest struct {
	Phone string `json:"phone"`
}

type verifyOTPRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type recoverRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
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

// POST /api/auth/send-otp
func (s *Server) handleSendOTP(w http.ResponseWriter, r *http.Request) {
	var req sendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Phone = normalizePhone(req.Phone)
	if !validPhone(req.Phone) {
		writeErr(w, http.StatusBadRequest, "invalid phone number")
		return
	}
	if err := s.auth.SendOTP(req.Phone); err != nil {
		if errors.Is(err, service.ErrPhoneTaken) {
			writeConflict(w, "phone number already registered", "phone")
			return
		}
		var cooldown *service.OTPCooldownError
		if errors.As(err, &cooldown) {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": cooldown.Error(), "code": "otp_cooldown", "retry_after": cooldown.RetryAfter})
			return
		}
		if errors.Is(err, service.ErrOTPRateLimited) {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "OTP limit reached for today", "code": "otp_daily_limit"})
			return
		}
		writeErr(w, http.StatusInternalServerError, "could not send OTP")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

// POST /api/auth/verify-otp  →  { phone_token }
func (s *Server) handleVerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req verifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Phone = normalizePhone(req.Phone)
	if !validPhone(req.Phone) {
		writeErr(w, http.StatusBadRequest, "phone must be exactly 10 digits")
		return
	}
	phoneToken, err := s.auth.VerifyOTPAndIssuePhoneToken(req.Phone, req.Code)
	if errors.Is(err, service.ErrInvalidOTP) {
		writeErr(w, http.StatusUnauthorized, "invalid or expired OTP")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "OTP verification failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"phone_token": phoneToken})
}

// POST /api/auth/signup
func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	if !usernameRe.MatchString(req.Username) {
		writeErr(w, http.StatusBadRequest, "username must be 3-16 chars: letters and numbers only")
		return
	}
	if !pinRe.MatchString(req.Pin) {
		writeErr(w, http.StatusBadRequest, "PIN must be exactly 4 digits")
		return
	}
	if req.PhoneToken == "" {
		writeErr(w, http.StatusBadRequest, "phone_token is required")
		return
	}
	phone, err := s.auth.ParsePhoneToken(req.PhoneToken)
	if errors.Is(err, service.ErrInvalidToken) {
		writeErr(w, http.StatusUnauthorized, "phone_token expired — please verify OTP again")
		return
	}
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid phone_token")
		return
	}

	token, _, err := s.auth.Signup(req.Username, req.Pin, phone)
	if errors.Is(err, service.ErrUsernameTaken) {
		writeConflict(w, "username already taken", "username")
		return
	}
	if errors.Is(err, service.ErrPhoneTaken) {
		writeConflict(w, "phone number already registered", "phone")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create user")
		return
	}
	writeJSON(w, http.StatusCreated, authResponse{Token: token, Username: req.Username})
}

// POST /api/auth/login
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	if !usernameRe.MatchString(req.Username) {
		writeErr(w, http.StatusBadRequest, "username must be 3-16 chars: letters and numbers only")
		return
	}
	if !pinRe.MatchString(req.Pin) {
		writeErr(w, http.StatusBadRequest, "PIN must be exactly 4 digits")
		return
	}

	token, _, err := s.auth.Login(req.Username, req.Pin)
	if errors.Is(err, service.ErrUsernameNotFound) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "username not found", "code": "username_not_found"})
		return
	}
	if errors.Is(err, service.ErrInvalidCredentials) {
		writeErr(w, http.StatusUnauthorized, "wrong username or PIN")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, authResponse{Token: token, Username: req.Username})
}

// POST /api/auth/logout
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "logged out"})
}

// POST /api/auth/recover-send-otp  (recovery flow only — phone must exist)
func (s *Server) handleSendRecoverOTP(w http.ResponseWriter, r *http.Request) {
	var req sendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Phone = normalizePhone(req.Phone)
	if !validPhone(req.Phone) {
		writeErr(w, http.StatusBadRequest, "invalid phone number")
		return
	}
	if err := s.auth.SendRecoverOTP(req.Phone); err != nil {
		if errors.Is(err, service.ErrPhoneNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "no account found with this number", "code": "phone_not_found"})
			return
		}
		var cooldown *service.OTPCooldownError
		if errors.As(err, &cooldown) {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": cooldown.Error(), "code": "otp_cooldown", "retry_after": cooldown.RetryAfter})
			return
		}
		if errors.Is(err, service.ErrOTPRateLimited) {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "OTP limit reached for today", "code": "otp_daily_limit"})
			return
		}
		writeErr(w, http.StatusInternalServerError, "could not send OTP")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

// POST /api/auth/recover  →  { username }
func (s *Server) handleRecoverUsername(w http.ResponseWriter, r *http.Request) {
	var req recoverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Phone = normalizePhone(req.Phone)
	if !validPhone(req.Phone) {
		writeErr(w, http.StatusBadRequest, "phone must be exactly 10 digits")
		return
	}
	username, err := s.auth.RecoverUsername(req.Phone, req.Code)
	if errors.Is(err, service.ErrInvalidOTP) {
		writeErr(w, http.StatusUnauthorized, "invalid or expired OTP")
		return
	}
	if errors.Is(err, service.ErrPhoneNotFound) {
		writeErr(w, http.StatusNotFound, "no account found for this phone number")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "recovery failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"username": username})
}
