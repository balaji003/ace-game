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

// CreateUser registers the account. No user_stats row is seeded here — RecordGame
// upserts one on the first completed game, so a player who never finishes a game
// simply has no stats row (GetStats reports zeroes for them either way).
func (s *mysqlStore) CreateUser(username, email, authID string) (int64, error) {
	res, err := s.db.Exec(`INSERT INTO users (username, email, auth_id) VALUES (?, ?, ?)`, username, email, authID)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
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

	// Upsert so the first game creates the row. MySQL evaluates SET assignments
	// left to right against already-updated values, so best_streak must be
	// computed BEFORE current_streak is incremented or it lands one too high.
	var statsSQL string
	if req.Won {
		statsSQL = `INSERT INTO user_stats (user_id, played, wins, losses, current_streak, best_streak)
			VALUES (?, 1, 1, 0, 1, 1)
			ON DUPLICATE KEY UPDATE
			    played = played + 1, wins = wins + 1,
			    best_streak = GREATEST(best_streak, current_streak + 1),
			    current_streak = current_streak + 1`
	} else {
		statsSQL = `INSERT INTO user_stats (user_id, played, wins, losses, current_streak, best_streak)
			VALUES (?, 1, 0, 1, 0, 0)
			ON DUPLICATE KEY UPDATE
			    played = played + 1, losses = losses + 1, current_streak = 0`
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
