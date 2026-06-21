package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env            string
	AllowedOrigins []string
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
	MaxTurnRetries     int
	MinPlayers         int
	MaxPlayers         int
	RecentGamesLimit   int
}

// IsProd reports whether the server is running in production mode.
func (c *Config) IsProd() bool { return c.Env == "prod" }

// OriginAllowed reports whether an HTTP/WS Origin is permitted (used by CORS and
// the WebSocket upgrader). "*" in the list allows any origin.
func (c *Config) OriginAllowed(origin string) bool {
	for _, o := range c.AllowedOrigins {
		if o == "*" || o == origin {
			return true
		}
	}
	return false
}

func Load() (*Config, error) {
	c := &Config{
		Env:  getenv("APP_ENV", "dev"),
		Port: getenv("PORT", "8080"),
	}

	// CORS / WS origin policy is environment-dependent.
	//   dev  → default to "*" so LAN devices (phones on the same WiFi) can connect.
	//   prod → an explicit origin is required; refuse to fall back to a wildcard.
	c.AllowOrigin = getenv("ALLOW_ORIGIN", "")
	if c.AllowOrigin == "" {
		if c.IsProd() {
			return nil, errors.New("ALLOW_ORIGIN must be set in production (no wildcard allowed)")
		}
		c.AllowOrigin = "*"
	}
	if c.IsProd() && c.AllowOrigin == "*" {
		return nil, errors.New("ALLOW_ORIGIN must not be \"*\" in production")
	}
	// ALLOW_ORIGIN is a comma-separated list — e.g. the web domain plus the
	// native WebView origin "capacitor://localhost" for the mobile apps.
	for _, o := range strings.Split(c.AllowOrigin, ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.AllowedOrigins = append(c.AllowedOrigins, o)
		}
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
	// Max "I am here" retries a stalling player gets before being dropped.
	// Shared by the offline AFK popup and online no-response handling.
	c.MaxTurnRetries, _ = strconv.Atoi(getenv("MAX_TURN_RETRIES", getenv("ONLINE_WARN_COUNT", "3")))
	if c.MaxTurnRetries <= 0 {
		c.MaxTurnRetries = 3
	}
	// Player-count bounds — shared by online rooms and the offline lobby.
	// A game is strictly 3–7 players; out-of-range or invalid values are pinned
	// into that range (and min never exceeds max).
	c.MinPlayers = intEnvClamped("MIN_PLAYERS", 3, HardMinPlayers, HardMaxPlayers)
	c.MaxPlayers = intEnvClamped("MAX_PLAYERS", 7, HardMinPlayers, HardMaxPlayers)
	if c.MaxPlayers < c.MinPlayers {
		c.MaxPlayers = c.MinPlayers
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

// Hard, non-overridable player-count limits. The engine floor is 2 (a game
// needs at least two players); the ceiling is 7. The business default is 3–7
// (see Load), but MIN_PLAYERS can be lowered to 2 for testing.
const (
	HardMinPlayers = 2
	HardMaxPlayers = 7
)

// intEnvClamped reads an int env var, falling back to def when unset or invalid,
// then pins the result into [lo, hi].
func intEnvClamped(key string, def, lo, hi int) int {
	v, err := strconv.Atoi(os.Getenv(key))
	if err != nil {
		v = def
	}
	if v < lo {
		v = lo
	}
	if v > hi {
		v = hi
	}
	return v
}
