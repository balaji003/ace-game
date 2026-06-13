package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"example.com/model"
)

func (s *Server) handleAIMove(w http.ResponseWriter, r *http.Request) {
	var req model.AIMoveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(req.ValidMoves) == 0 {
		writeErr(w, http.StatusBadRequest, "no valid moves provided")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 18*time.Second)
	defer cancel()

	idx, err := s.ai.PickMove(ctx, req)
	if err != nil {
		writeErr(w, http.StatusBadGateway, "ai upstream error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"index":  idx,
		"card":   req.ValidMoves[idx],
		"usedAI": true,
	})
}
