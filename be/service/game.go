package service

import (
	"example.com/model"
	"example.com/store"
)


type GameService struct {
	store store.Store
}

func NewGame(st store.Store) *GameService {
	return &GameService{store: st}
}

func (s *GameService) GetStats(uid int64) (model.Stats, error) {
	return s.store.GetStats(uid)
}

func (s *GameService) RecordGame(uid int64, req model.RecordGameRequest) (model.Stats, error) {
	if req.Mode == "" {
		req.Mode = "vs AI"
	}
	if req.Opponents == nil {
		req.Opponents = []string{}
	}
	return s.store.RecordGame(uid, req)
}

func (s *GameService) GetHistory(uid int64, limit, offset int) ([]model.Game, error) {
	return s.store.GetHistory(uid, limit, offset)
}

func (s *GameService) GetSMSConfig() (model.SMSConfig, error) {
	return s.store.GetSMSConfig()
}

func (s *GameService) SaveSMSConfig(cfg model.SMSConfig) error {
	return s.store.SaveSMSConfig(cfg)
}
