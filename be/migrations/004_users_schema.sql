-- Migration 004: tighten users table — username varchar(16), add updated_at
-- Run: mysql -u aceuser -p'ace@52' ace < be/migrations/004_users_schema.sql

USE ace;

ALTER TABLE users
  MODIFY COLUMN username  VARCHAR(16) NOT NULL,
  MODIFY COLUMN phone     VARCHAR(20) NULL,
  ADD    COLUMN updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                           AFTER created_at;
