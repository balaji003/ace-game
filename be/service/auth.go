package service

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"example.com/config"
	"example.com/store"
)

var (
	ErrUsernameTaken      = errors.New("username already taken")
	ErrPhoneTaken         = errors.New("phone number already registered")
	ErrInvalidCredentials = errors.New("wrong username or PIN")
	ErrUsernameNotFound   = errors.New("username not found")
	ErrInvalidToken       = errors.New("invalid token")
	ErrInvalidOTP         = errors.New("invalid or expired OTP")
	ErrPhoneNotFound      = errors.New("no account found for this phone number")
	ErrOTPRateLimited     = errors.New("too many OTP requests today")
)

type OTPCooldownError struct{ RetryAfter int }

func (e *OTPCooldownError) Error() string {
	return fmt.Sprintf("please wait %d seconds before resending OTP", e.RetryAfter)
}

type Claims struct {
	UserID   int64  `json:"uid"`
	Username string `json:"un"`
	jwt.RegisteredClaims
}

// PhoneClaims is a short-lived JWT issued after OTP verification.
// The frontend includes it in the signup request to prove phone ownership.
type PhoneClaims struct {
	Phone string `json:"phone"`
	jwt.RegisteredClaims
}

type AuthService struct {
	store store.Store
	cfg   *config.Config
	sms   SMSSender
}

func NewAuth(st store.Store, cfg *config.Config, sms SMSSender) *AuthService {
	return &AuthService{store: st, cfg: cfg, sms: sms}
}

func (s *AuthService) Signup(username, pin, phone string) (token string, uid int64, err error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	if err != nil {
		return "", 0, err
	}
	uid, err = s.store.CreateUser(username, string(hash), phone)
	if err != nil {
		var myErr *mysql.MySQLError
		if errors.As(err, &myErr) && myErr.Number == 1062 {
			if strings.Contains(myErr.Message, "phone") {
				return "", 0, ErrPhoneTaken
			}
			return "", 0, ErrUsernameTaken
		}
		return "", 0, err
	}
	token, err = issueToken(s.cfg.JWTSecret, uid, username, s.cfg.JWTTTL)
	return token, uid, err
}

func (s *AuthService) Login(username, pin string) (token string, uid int64, err error) {
	uid, pinHash, err := s.store.GetUser(username)
	if errors.Is(err, sql.ErrNoRows) {
		return "", 0, ErrUsernameNotFound
	}
	if err != nil {
		return "", 0, err
	}
	if bcrypt.CompareHashAndPassword([]byte(pinHash), []byte(pin)) != nil {
		return "", 0, ErrInvalidCredentials
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

// SendOTP generates a 6-digit code, stores it, and sends it via SMS.
func (s *AuthService) SendOTP(phone string) error {
	_, _, err := s.store.GetUserByPhone(phone)
	if err == nil {
		return ErrPhoneTaken
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	if err := s.checkOTPLimits(phone); err != nil {
		return err
	}
	code, err := generateOTP()
	if err != nil {
		return err
	}
	if err := s.store.SaveOTP(phone, code, time.Now().Add(10*time.Minute)); err != nil {
		return err
	}
	return s.sms.Send(phone, fmt.Sprintf("Your ACE game OTP: %s (valid 10 minutes)", code))
}

// SendRecoverOTP sends an OTP only if the phone is registered (for username recovery).
func (s *AuthService) SendRecoverOTP(phone string) error {
	_, _, err := s.store.GetUserByPhone(phone)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrPhoneNotFound
	}
	if err != nil {
		return err
	}

	if err := s.checkOTPLimits(phone); err != nil {
		return err
	}
	code, err := generateOTP()
	if err != nil {
		return err
	}
	if err := s.store.SaveOTP(phone, code, time.Now().Add(10*time.Minute)); err != nil {
		return err
	}
	return s.sms.Send(phone, fmt.Sprintf("Your ACE game OTP: %s (valid 10 minutes)", code))
}

func (s *AuthService) checkOTPLimits(phone string) error {
	secs, exists, err := s.store.SecondsSinceLastOTP(phone)
	if err != nil {
		return err
	}
	if exists && secs < s.cfg.OTPCooldownSecs {
		return &OTPCooldownError{RetryAfter: s.cfg.OTPCooldownSecs - secs}
	}
	count, err := s.store.CountOTPsToday(phone)
	if err != nil {
		return err
	}
	if count >= s.cfg.OTPMaxPerDay {
		return ErrOTPRateLimited
	}
	return nil
}

// VerifyOTPAndIssuePhoneToken checks the OTP, consumes it, and returns a 5-min phone JWT.
func (s *AuthService) VerifyOTPAndIssuePhoneToken(phone, code string) (string, error) {
	ok, err := s.store.VerifyAndConsumeOTP(phone, code)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", ErrInvalidOTP
	}
	claims := PhoneClaims{
		Phone: phone,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.cfg.JWTSecret)
}

// ParsePhoneToken validates a phone JWT and returns the phone number.
func (s *AuthService) ParsePhoneToken(tokenStr string) (string, error) {
	claims := &PhoneClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.cfg.JWTSecret, nil
	})
	if err != nil || !token.Valid || claims.Phone == "" {
		return "", ErrInvalidToken
	}
	return claims.Phone, nil
}

// RecoverUsername looks up a username by phone after verifying the OTP.
func (s *AuthService) RecoverUsername(phone, code string) (string, error) {
	ok, err := s.store.VerifyAndConsumeOTP(phone, code)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", ErrInvalidOTP
	}
	_, username, err := s.store.GetUserByPhone(phone)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrPhoneNotFound
	}
	return username, err
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

func generateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n), nil
}
