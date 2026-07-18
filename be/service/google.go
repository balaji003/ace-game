package service

import (
	"context"
	"errors"

	"google.golang.org/api/idtoken"
)

// GoogleClaims is the subset of a verified Google ID token that we use.
type GoogleClaims struct {
	Sub   string // stable, unique per-user Google identifier → users.auth_id
	Email string
	Name  string
}

// GoogleVerifier validates a Google ID token and returns its claims. The
// production implementation checks the signature against Google's public keys;
// tests supply a stub so they don't hit the network.
type GoogleVerifier interface {
	Verify(ctx context.Context, idToken string) (*GoogleClaims, error)
}

// ErrInvalidGoogleToken is returned when an ID token fails verification.
var ErrInvalidGoogleToken = errors.New("invalid Google ID token")

type googleIDTokenVerifier struct {
	audiences []string
}

// NewGoogleVerifier verifies ID tokens against Google's JWKS, accepting a token
// whose audience matches any of the configured client IDs.
func NewGoogleVerifier(audiences []string) GoogleVerifier {
	return &googleIDTokenVerifier{audiences: audiences}
}

func (v *googleIDTokenVerifier) Verify(ctx context.Context, token string) (*GoogleClaims, error) {
	var payload *idtoken.Payload
	for _, aud := range v.audiences {
		p, err := idtoken.Validate(ctx, token, aud)
		if err == nil {
			payload = p
			break
		}
	}
	if payload == nil || payload.Subject == "" {
		return nil, ErrInvalidGoogleToken
	}
	claims := &GoogleClaims{Sub: payload.Subject}
	if e, ok := payload.Claims["email"].(string); ok {
		claims.Email = e
	}
	if n, ok := payload.Claims["name"].(string); ok {
		claims.Name = n
	}
	return claims, nil
}
