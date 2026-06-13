package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"example.com/model"
)


func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	st, err := s.game.GetStats(userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load stats")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"username": username(r), "stats": st})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	st, err := s.game.GetStats(userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load stats")
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) handleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	if err := s.auth.DeleteAccount(userID(r)); err != nil {
		writeErr(w, http.StatusInternalServerError, "could not delete account")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "account deleted"})
}

func (s *Server) handleRecordGame(w http.ResponseWriter, r *http.Request) {
	var req model.RecordGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	st, err := s.game.RecordGame(userID(r), req)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not record game")
		return
	}
	writeJSON(w, http.StatusCreated, st)
}

// GET /api/admin/sms-config
func (s *Server) handleGetSMSConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := s.game.GetSMSConfig()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load sms config")
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

// PUT /api/admin/sms-config
func (s *Server) handleSaveSMSConfig(w http.ResponseWriter, r *http.Request) {
	var cfg model.SMSConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if err := s.game.SaveSMSConfig(cfg); err != nil {
		writeErr(w, http.StatusInternalServerError, "could not save sms config")
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if q := r.URL.Query().Get("limit"); q != "" {
		if n, err := strconv.Atoi(q); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	offset := 0
	if q := r.URL.Query().Get("offset"); q != "" {
		if n, err := strconv.Atoi(q); err == nil && n >= 0 {
			offset = n
		}
	}
	games, err := s.game.GetHistory(userID(r), limit, offset)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load history")
		return
	}
	writeJSON(w, http.StatusOK, games)
}
