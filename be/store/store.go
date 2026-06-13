package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"example.com/model"
)

type Store interface {
	CreateUser(username, pinHash, phone string) (int64, error)
	GetUser(username string) (uid int64, pinHash string, err error)
	GetUserByPhone(phone string) (uid int64, username string, err error)
	DeleteUser(uid int64) error
	GetStats(uid int64) (model.Stats, error)
	RecordGame(uid int64, req model.RecordGameRequest) (model.Stats, error)
	GetHistory(uid int64, limit, offset int) ([]model.Game, error)
	SaveOTP(phone, code string, expiresAt time.Time) error
	VerifyAndConsumeOTP(phone, code string) (bool, error)
	CountOTPsToday(phone string) (int, error)
	SecondsSinceLastOTP(phone string) (secs int, exists bool, err error)
	UsernameExists(username string) (bool, error)
	GetSMSConfig() (model.SMSConfig, error)
	SaveSMSConfig(cfg model.SMSConfig) error
}

type mysqlStore struct {
	db *sql.DB
}

func New(db *sql.DB) Store {
	return &mysqlStore{db: db}
}

func (s *mysqlStore) CreateUser(username, pinHash, phone string) (int64, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback() //nolint:errcheck

	res, err := tx.Exec(`INSERT INTO users (username, pin_hash, phone) VALUES (?, ?, ?)`, username, pinHash, phone)
	if err != nil {
		return 0, err
	}
	uid, _ := res.LastInsertId()

	if _, err := tx.Exec(`INSERT INTO user_stats (user_id) VALUES (?)`, uid); err != nil {
		return 0, err
	}
	return uid, tx.Commit()
}

func (s *mysqlStore) GetUser(username string) (int64, string, error) {
	var uid int64
	var pinHash string
	err := s.db.QueryRow(`SELECT id, pin_hash FROM users WHERE username = ?`, username).
		Scan(&uid, &pinHash)
	return uid, pinHash, err
}

func (s *mysqlStore) GetUserByPhone(phone string) (int64, string, error) {
	var uid int64
	var username string
	err := s.db.QueryRow(`SELECT id, username FROM users WHERE phone = ?`, phone).
		Scan(&uid, &username)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, "", sql.ErrNoRows
	}
	return uid, username, err
}

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

// SaveOTP invalidates existing OTPs for this phone and inserts a fresh one.
// Old rows are kept (marked used) so CountOTPsToday reflects the true daily total.
func (s *mysqlStore) SaveOTP(phone, code string, expiresAt time.Time) error {
	_, _ = s.db.Exec(`UPDATE otp_requests SET used = TRUE WHERE phone = ? AND used = FALSE`, phone)
	_, err := s.db.Exec(
		`INSERT INTO otp_requests (phone, code, expires_at) VALUES (?, ?, ?)`,
		phone, code, expiresAt,
	)
	return err
}

func (s *mysqlStore) SecondsSinceLastOTP(phone string) (int, bool, error) {
	var secs int
	err := s.db.QueryRow(
		`SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) FROM otp_requests WHERE phone = ? ORDER BY created_at DESC LIMIT 1`,
		phone,
	).Scan(&secs)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	return secs, err == nil, err
}

func (s *mysqlStore) GetSMSConfig() (model.SMSConfig, error) {
	var c model.SMSConfig
	err := s.db.QueryRow(
		`SELECT provider, api_key, account_sid, auth_token, from_number FROM sms_config WHERE id = 1`,
	).Scan(&c.Provider, &c.APIKey, &c.AccountSID, &c.AuthToken, &c.From)
	return c, err
}

func (s *mysqlStore) SaveSMSConfig(cfg model.SMSConfig) error {
	_, err := s.db.Exec(`
		INSERT INTO sms_config (id, provider, api_key, account_sid, auth_token, from_number)
		VALUES (1, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
		  provider    = VALUES(provider),
		  api_key     = VALUES(api_key),
		  account_sid = VALUES(account_sid),
		  auth_token  = VALUES(auth_token),
		  from_number = VALUES(from_number)
	`, cfg.Provider, cfg.APIKey, cfg.AccountSID, cfg.AuthToken, cfg.From)
	return err
}

func (s *mysqlStore) UsernameExists(username string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)`, username).Scan(&exists)
	return exists, err
}

func (s *mysqlStore) CountOTPsToday(phone string) (int, error) {
	var n int
	err := s.db.QueryRow(
		`SELECT COUNT(*) FROM otp_requests WHERE phone = ? AND created_at >= CURDATE()`, phone,
	).Scan(&n)
	return n, err
}

// VerifyAndConsumeOTP atomically marks the OTP used and returns whether it was valid.
func (s *mysqlStore) VerifyAndConsumeOTP(phone, code string) (bool, error) {
	res, err := s.db.Exec(`
		UPDATE otp_requests SET used = TRUE
		WHERE phone = ? AND code = ? AND used = FALSE AND expires_at > NOW()
		ORDER BY id DESC LIMIT 1
	`, phone, code)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
