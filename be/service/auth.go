package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"

	"example.com/config"
	"example.com/store"
)

var (
	ErrUsernameTaken = errors.New("username already taken")
	ErrAccountExists = errors.New("account already registered")
	ErrInvalidToken  = errors.New("invalid token")
)

type Claims struct {
	UserID   int64  `json:"uid"`
	Username string `json:"un"`
	jwt.RegisteredClaims
}

// GoogleSignupClaims is a short-lived JWT minted once a Google ID token is
// verified for a person who has no account yet. The frontend echoes it back
// with the chosen username to complete signup, so the verified identity
// (sub/email) can't be tampered with between the two calls.
type GoogleSignupClaims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	jwt.RegisteredClaims
}

type AuthService struct {
	store    store.Store
	cfg      *config.Config
	verifier GoogleVerifier
}

func NewAuth(st store.Store, cfg *config.Config, verifier GoogleVerifier) *AuthService {
	return &AuthService{store: st, cfg: cfg, verifier: verifier}
}

// GoogleAuthResult is the outcome of a Google sign-in: either an existing user
// (Token/Username set) or a new user who must pick a username (NeedsUsername
// true, SignupToken set).
type GoogleAuthResult struct {
	Token         string
	Username      string
	NeedsUsername bool
	SignupToken   string
}

// GoogleAuth verifies a Google ID token and logs the user in. A returning user
// (matched by Google sub) gets a session token immediately; a new user gets a
// short-lived signup token and must choose a username via CompleteGoogleSignup.
func (s *AuthService) GoogleAuth(ctx context.Context, idToken string) (*GoogleAuthResult, error) {
	gc, err := s.verifier.Verify(ctx, idToken)
	if err != nil {
		return nil, ErrInvalidToken
	}

	uid, username, err := s.store.GetUserByAuthID(gc.Sub)
	if err == nil {
		token, err := issueToken(s.cfg.JWTSecret, uid, username, s.cfg.JWTTTL)
		if err != nil {
			return nil, err
		}
		return &GoogleAuthResult{Token: token, Username: username}, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// No account yet — hand back a signup token carrying the verified identity.
	signupToken, err := s.issueGoogleSignupToken(gc.Sub, gc.Email)
	if err != nil {
		return nil, err
	}
	return &GoogleAuthResult{NeedsUsername: true, SignupToken: signupToken}, nil
}

// CompleteGoogleSignup creates the account for a new Google user who has picked
// a username, using the identity carried by the signup token.
func (s *AuthService) CompleteGoogleSignup(signupToken, username string) (token string, uid int64, err error) {
	sub, email, err := s.parseGoogleSignupToken(signupToken)
	if err != nil {
		return "", 0, err
	}
	uid, err = s.store.CreateUser(username, email, sub)
	if err != nil {
		var myErr *mysql.MySQLError
		if errors.As(err, &myErr) && myErr.Number == 1062 {
			if strings.Contains(myErr.Message, "username") {
				return "", 0, ErrUsernameTaken
			}
			// Duplicate auth_id/email — the account already exists.
			return "", 0, ErrAccountExists
		}
		return "", 0, err
	}
	token, err = issueToken(s.cfg.JWTSecret, uid, username, s.cfg.JWTTTL)
	return token, uid, err
}

func (s *AuthService) DeleteAccount(uid int64) error {
	return s.store.DeleteUser(uid)
}

// CheckUsername reports whether the username is already taken.
func (s *AuthService) CheckUsername(username string) (bool, error) {
	return s.store.UsernameExists(username)
}

func (s *AuthService) ParseToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.cfg.JWTSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

func (s *AuthService) issueGoogleSignupToken(sub, email string) (string, error) {
	claims := GoogleSignupClaims{
		Sub:   sub,
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.cfg.JWTSecret)
}

func (s *AuthService) parseGoogleSignupToken(tokenStr string) (sub, email string, err error) {
	claims := &GoogleSignupClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.cfg.JWTSecret, nil
	})
	if err != nil || !token.Valid || claims.Sub == "" {
		return "", "", ErrInvalidToken
	}
	return claims.Sub, claims.Email, nil
}

func issueToken(secret []byte, userID int64, username string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			Subject:   username,
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}
