-- Migration 002: add phone to users, add otp_requests table
-- Run: mysql -u aceuser -p ace < be/migrations/002_phone_otp.sql

USE ace;

ALTER TABLE users
  ADD COLUMN phone VARCHAR(20) NULL UNIQUE AFTER username;

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
