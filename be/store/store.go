package store

import (
	"database/sql"
	"encoding/json"
	"errors"

	"example.com/model"
)

type Store interface {
	CreateUser(username, email, authID string) (int64, error)
	GetUserByAuthID(authID string) (uid int64, username string, err error)
	DeleteUser(uid int64) error
	GetStats(uid int64) (model.Stats, error)
	RecordGame(uid int64, req model.RecordGameRequest) (model.Stats, error)
	GetHistory(uid int64, limit, offset int) ([]model.Game, error)
	UsernameExists(username string) (bool, error)
}

type mysqlStore struct {
	db *sql.DB
}

func New(db *sql.DB) Store {
	return &mysqlStore{db: db}
}

func (s *mysqlStore) CreateUser(username, email, authID string) (int64, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback() //nolint:errcheck

	res, err := tx.Exec(`INSERT INTO users (username, email, auth_id) VALUES (?, ?, ?)`, username, email, authID)
	if err != nil {
		return 0, err
	}
	uid, _ := res.LastInsertId()

	if _, err := tx.Exec(`INSERT INTO user_stats (user_id) VALUES (?)`, uid); err != nil {
		return 0, err
	}
	return uid, tx.Commit()
}

// GetUserByAuthID looks up an account by its Google subject identifier.
func (s *mysqlStore) GetUserByAuthID(authID string) (int64, string, error) {
	var uid int64
	var username string
	err := s.db.QueryRow(`SELECT id, username FROM users WHERE auth_id = ?`, authID).
		Scan(&uid, &username)
	return uid, username, err
}

// DeleteUser erases the account and all of its personal data. user_stats and
// games are removed automatically via ON DELETE CASCADE.
func (s *mysqlStore) DeleteUser(uid int64) error {
	_, err := s.db.Exec(`DELETE FROM users WHERE id = ?`, uid)
	return err
}

func (s *mysqlStore) GetStats(uid int64) (model.Stats, error) {
	var st model.Stats
	err := s.db.QueryRow(
		`SELECT played, wins, losses, current_streak, best_streak
		   FROM user_stats WHERE user_id = ?`, uid).
		Scan(&st.Played, &st.Wins, &st.Losses, &st.CurrentStreak, &st.BestStreak)
	if errors.Is(err, sql.ErrNoRows) {
		return model.Stats{}, nil
	}
	return st, err
}

func (s *mysqlStore) RecordGame(uid int64, req model.RecordGameRequest) (model.Stats, error) {
	oppJSON, _ := json.Marshal(req.Opponents)

	tx, err := s.db.Begin()
	if err != nil {
		return model.Stats{}, err
	}
	defer tx.Rollback() //nolint:errcheck

	if _, err := tx.Exec(
		`INSERT INTO games (user_id, won, placement, mode, opponents) VALUES (?, ?, ?, ?, ?)`,
		uid, req.Won, req.Placement, req.Mode, string(oppJSON),
	); err != nil {
		return model.Stats{}, err
	}

	var statsSQL string
	if req.Won {
		statsSQL = `UPDATE user_stats
			SET played = played + 1, wins = wins + 1,
			    current_streak = current_streak + 1,
			    best_streak = GREATEST(best_streak, current_streak + 1)
			WHERE user_id = ?`
	} else {
		statsSQL = `UPDATE user_stats
			SET played = played + 1, losses = losses + 1, current_streak = 0
			WHERE user_id = ?`
	}
	if _, err := tx.Exec(statsSQL, uid); err != nil {
		return model.Stats{}, err
	}
	if err := tx.Commit(); err != nil {
		return model.Stats{}, err
	}

	return s.GetStats(uid)
}

func (s *mysqlStore) GetHistory(uid int64, limit, offset int) ([]model.Game, error) {
	rows, err := s.db.Query(
		`SELECT id, played_at, won, placement, mode, opponents
		   FROM games WHERE user_id = ? ORDER BY played_at DESC LIMIT ? OFFSET ?`, uid, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	games := make([]model.Game, 0, limit)
	for rows.Next() {
		var g model.Game
		var opp []byte
		if err := rows.Scan(&g.ID, &g.PlayedAt, &g.Won, &g.Placement, &g.Mode, &opp); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(opp, &g.Opponents)
		games = append(games, g)
	}
	return games, rows.Err()
}

func (s *mysqlStore) UsernameExists(username string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)`, username).Scan(&exists)
	return exists, err
}
