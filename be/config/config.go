package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port         string
	DSN          string
	JWTSecret    []byte
	JWTTTL       time.Duration
	AllowOrigin  string
	AnthropicKey string
	AIModel      string
	OTPMaxPerDay       int
	OTPCooldownSecs    int
	WatchCountdownSecs int
	AFKWarnSecs        int
	AFKGraceSecs       int
	RecentGamesLimit   int
}

func Load() (*Config, error) {
	c := &Config{
		Port:        getenv("PORT", "8080"),
		AllowOrigin: getenv("ALLOW_ORIGIN", "*"),
	}

	user := getenv("DB_USER", "root")
	pass := getenv("DB_PASS", "")
	host := getenv("DB_HOST", "127.0.0.1")
	port := getenv("DB_PORT", "3306")
	name := getenv("DB_NAME", "ace_db")
	c.DSN = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=UTC&time_zone=%%27%%2B00%%3A00%%27",
		user, pass, host, port, name)

	secret := getenv("JWT_SECRET", "")
	if secret == "" {
		return nil, errors.New("JWT_SECRET must be set")
	}
	c.JWTSecret = []byte(secret)
	c.JWTTTL = 30 * 24 * time.Hour

	c.AnthropicKey = getenv("ANTHROPIC_API_KEY", "")
	c.AIModel = getenv("AI_MODEL", "claude-sonnet-4-20250514")
	c.OTPMaxPerDay, _ = strconv.Atoi(getenv("OTP_MAX_PER_DAY", "5"))
	if c.OTPMaxPerDay <= 0 {
		c.OTPMaxPerDay = 5
	}
	c.OTPCooldownSecs, _ = strconv.Atoi(getenv("OTP_COOLDOWN_SECS", "30"))
	if c.OTPCooldownSecs <= 0 {
		c.OTPCooldownSecs = 30
	}
	c.WatchCountdownSecs, _ = strconv.Atoi(getenv("WATCH_COUNTDOWN_SECS", "10"))
	if c.WatchCountdownSecs <= 0 {
		c.WatchCountdownSecs = 10
	}
	c.AFKWarnSecs, _ = strconv.Atoi(getenv("AFK_WARN_SECS", "20"))
	if c.AFKWarnSecs <= 0 {
		c.AFKWarnSecs = 20
	}
	c.AFKGraceSecs, _ = strconv.Atoi(getenv("AFK_GRACE_SECS", "10"))
	if c.AFKGraceSecs <= 0 {
		c.AFKGraceSecs = 10
	}
	c.RecentGamesLimit, _ = strconv.Atoi(getenv("RECENT_GAMES_LIMIT", "10"))
	if c.RecentGamesLimit <= 0 {
		c.RecentGamesLimit = 10
	}

	return c, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
