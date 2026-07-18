-- 005_google_auth.sql
-- Run: mysql -u aceuser -p'ace@52' ace < be/migrations/005_google_auth.sql
-- Migrate auth from phone/OTP/PIN to Google Sign-In.
--   * phone      → email
--   * new auth_id column holds the Google subject ("sub") as the account identity
--   * pin_hash dropped (no more PIN login)
--   * OTP / SMS tables removed
--
-- NOTE: existing phone/PIN accounts have no Google auth_id and cannot log in
-- after this. auth_id is NOT NULL, so this migration assumes an empty (or
-- truncated) users table. If real users exist, migrate or truncate first:
--   DELETE FROM users;   -- cascades to user_stats and games

USE ace;

ALTER TABLE users
  CHANGE COLUMN phone email VARCHAR(255) NULL,
  ADD COLUMN auth_id VARCHAR(255) NOT NULL AFTER email,
  DROP COLUMN pin_hash;

-- The phone unique index (named `phone` in the migration lineage) now sits on
-- the renamed email column; drop it and add cleanly-named unique keys.
ALTER TABLE users
  DROP INDEX phone,
  ADD UNIQUE KEY uq_users_email (email),
  ADD UNIQUE KEY uq_users_auth_id (auth_id);

DROP TABLE IF EXISTS otp_requests;
DROP TABLE IF EXISTS sms_config;
