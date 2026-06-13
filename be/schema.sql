-- ACE game backend — MySQL schema
-- Run: mysql -u root -p ace_db < migrations/001_init.sql

CREATE DATABASE IF NOT EXISTS ace_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ace_db;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username    VARCHAR(16)     NOT NULL,
  phone       VARCHAR(20)     NULL,
  pin_hash    VARCHAR(255)    NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB;

-- ── SMS provider config (single-row, editable at runtime) ────────────────────
CREATE TABLE IF NOT EXISTS sms_config (
  id          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  provider    VARCHAR(20)      NOT NULL DEFAULT 'log',
  api_key     VARCHAR(255)     NOT NULL DEFAULT '',
  account_sid VARCHAR(255)     NOT NULL DEFAULT '',
  auth_token  VARCHAR(255)     NOT NULL DEFAULT '',
  from_number VARCHAR(20)      NOT NULL DEFAULT '',
  updated_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_sms_singleton CHECK (id = 1)
) ENGINE=InnoDB;

INSERT IGNORE INTO sms_config (id) VALUES (1);

-- ── OTP requests (phone verification) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_requests (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone      VARCHAR(20)     NOT NULL,
  code       CHAR(6)         NOT NULL,
  expires_at TIMESTAMP       NOT NULL,
  used       BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_phone (phone, expires_at)
) ENGINE=InnoDB;

-- ── Per-user aggregate stats (updated transactionally on each game) ───────────
CREATE TABLE IF NOT EXISTS user_stats (
  user_id        BIGINT UNSIGNED NOT NULL,
  played         INT NOT NULL DEFAULT 0,
  wins           INT NOT NULL DEFAULT 0,
  losses         INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_stats_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Game history ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  played_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  won        BOOLEAN         NOT NULL,
  placement  INT             NOT NULL,          -- 1 = finished first, N = loser
  mode       VARCHAR(32)     NOT NULL DEFAULT 'vs AI',
  opponents  JSON            NOT NULL,          -- e.g. ["Alex","Sam","Jordan"]
  PRIMARY KEY (id),
  KEY idx_games_user_time (user_id, played_at DESC),
  CONSTRAINT fk_games_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
