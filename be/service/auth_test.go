package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"

	"example.com/config"
	"example.com/model"
)

// fakeStore is a minimal in-memory Store for auth tests.
type fakeStore struct {
	byAuthID     map[string]int64 // auth_id → uid
	usernames    map[string]int64 // username → uid
	createErr    error
	nextUID      int64
	createdCalls int
}

func newFakeStore() *fakeStore {
	return &fakeStore{byAuthID: map[string]int64{}, usernames: map[string]int64{}, nextUID: 1}
}

func (f *fakeStore) CreateUser(username, email, authID string) (int64, error) {
	f.createdCalls++
	if f.createErr != nil {
		return 0, f.createErr
	}
	uid := f.nextUID
	f.nextUID++
	f.byAuthID[authID] = uid
	f.usernames[username] = uid
	return uid, nil
}

func (f *fakeStore) GetUserByAuthID(authID string) (int64, string, error) {
	uid, ok := f.byAuthID[authID]
	if !ok {
		return 0, "", sql.ErrNoRows
	}
	return uid, "existing", nil
}

func (f *fakeStore) DeleteUser(uid int64) error                     { return nil }
func (f *fakeStore) GetStats(uid int64) (model.Stats, error)        { return model.Stats{}, nil }
func (f *fakeStore) UsernameExists(username string) (bool, error)   { _, ok := f.usernames[username]; return ok, nil }
func (f *fakeStore) RecordGame(uid int64, r model.RecordGameRequest) (model.Stats, error) {
	return model.Stats{}, nil
}
func (f *fakeStore) GetHistory(uid int64, limit, offset int) ([]model.Game, error) { return nil, nil }

// fakeVerifier returns fixed claims without hitting Google.
type fakeVerifier struct {
	claims *GoogleClaims
	err    error
}

func (v fakeVerifier) Verify(ctx context.Context, idToken string) (*GoogleClaims, error) {
	return v.claims, v.err
}

func newAuth(st *fakeStore, v GoogleVerifier) *AuthService {
	cfg := &config.Config{JWTSecret: []byte("test-secret"), JWTTTL: time.Hour}
	return NewAuth(st, cfg, v)
}

func TestGoogleAuth_ReturningUser(t *testing.T) {
	st := newFakeStore()
	st.byAuthID["sub-123"] = 42
	auth := newAuth(st, fakeVerifier{claims: &GoogleClaims{Sub: "sub-123", Email: "a@b.com"}})

	res, err := auth.GoogleAuth(context.Background(), "any")
	if err != nil {
		t.Fatalf("GoogleAuth: %v", err)
	}
	if res.NeedsUsername || res.Token == "" {
		t.Fatalf("want session token for returning user, got %+v", res)
	}
}

func TestGoogleAuth_NewUserNeedsUsername(t *testing.T) {
	st := newFakeStore()
	auth := newAuth(st, fakeVerifier{claims: &GoogleClaims{Sub: "sub-new", Email: "n@b.com"}})

	res, err := auth.GoogleAuth(context.Background(), "any")
	if err != nil {
		t.Fatalf("GoogleAuth: %v", err)
	}
	if !res.NeedsUsername || res.SignupToken == "" {
		t.Fatalf("want signup token for new user, got %+v", res)
	}

	// The signup token should complete signup for the same identity.
	token, _, err := auth.CompleteGoogleSignup(res.SignupToken, "newbie")
	if err != nil {
		t.Fatalf("CompleteGoogleSignup: %v", err)
	}
	if token == "" || st.createdCalls != 1 {
		t.Fatalf("expected account created once, got calls=%d token=%q", st.createdCalls, token)
	}
}

func TestGoogleAuth_InvalidToken(t *testing.T) {
	auth := newAuth(newFakeStore(), fakeVerifier{err: ErrInvalidGoogleToken})
	if _, err := auth.GoogleAuth(context.Background(), "bad"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("want ErrInvalidToken, got %v", err)
	}
}

func TestCompleteGoogleSignup_UsernameTaken(t *testing.T) {
	st := newFakeStore()
	st.createErr = &mysql.MySQLError{Number: 1062, Message: "Duplicate entry 'newbie' for key 'uq_users_username'"}
	auth := newAuth(st, fakeVerifier{claims: &GoogleClaims{Sub: "sub-x"}})

	res, _ := auth.GoogleAuth(context.Background(), "any")
	_, _, err := auth.CompleteGoogleSignup(res.SignupToken, "newbie")
	if !errors.Is(err, ErrUsernameTaken) {
		t.Fatalf("want ErrUsernameTaken, got %v", err)
	}
}

func TestCompleteGoogleSignup_DuplicateAccount(t *testing.T) {
	st := newFakeStore()
	st.createErr = &mysql.MySQLError{Number: 1062, Message: "Duplicate entry 'sub-x' for key 'uq_users_auth_id'"}
	auth := newAuth(st, fakeVerifier{claims: &GoogleClaims{Sub: "sub-x"}})

	res, _ := auth.GoogleAuth(context.Background(), "any")
	_, _, err := auth.CompleteGoogleSignup(res.SignupToken, "newbie")
	if !errors.Is(err, ErrAccountExists) {
		t.Fatalf("want ErrAccountExists, got %v", err)
	}
}

func TestCompleteGoogleSignup_BadSignupToken(t *testing.T) {
	auth := newAuth(newFakeStore(), fakeVerifier{claims: &GoogleClaims{Sub: "sub-x"}})
	if _, _, err := auth.CompleteGoogleSignup("not-a-jwt", "newbie"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("want ErrInvalidToken, got %v", err)
	}
}
