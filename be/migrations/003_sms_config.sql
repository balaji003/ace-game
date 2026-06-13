-- Migration 003: SMS provider config stored in DB (single-row table)
-- Run: mysql -u aceuser -p ace < be/migrations/003_sms_config.sql

USE ace;

CREATE TABLE IF NOT EXISTS sms_config (
  id          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  provider    VARCHAR(20)      NOT NULL DEFAULT 'log',   -- 'log' | 'fast2sms' | 'twilio'
  api_key     VARCHAR(255)     NOT NULL DEFAULT '',       -- Fast2SMS API key
  account_sid VARCHAR(255)     NOT NULL DEFAULT '',       -- Twilio Account SID
  auth_token  VARCHAR(255)     NOT NULL DEFAULT '',       -- Twilio Auth Token
  from_number VARCHAR(20)      NOT NULL DEFAULT '',       -- Twilio From number
  updated_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_sms_singleton CHECK (id = 1)
) ENGINE=InnoDB;

-- Seed the single config row (no-op if already present)
INSERT IGNORE INTO sms_config (id) VALUES (1);
