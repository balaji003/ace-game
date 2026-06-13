package service

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"

	"example.com/model"
	"example.com/store"
)

// SMSSender is the single interface all providers must satisfy.
type SMSSender interface {
	Send(phone, message string) error
}

// DBSMSSender reads provider config from the sms_config table on every send,
// so switching providers takes effect immediately without restarting the server.
type DBSMSSender struct {
	store store.Store
}

func NewDBSMSSender(st store.Store) SMSSender {
	return DBSMSSender{store: st}
}

func (s DBSMSSender) Send(phone, message string) error {
	cfg, err := s.store.GetSMSConfig()
	if err != nil {
		return fmt.Errorf("load sms config: %w", err)
	}
	return providerFor(cfg).Send(phone, message)
}

func providerFor(cfg model.SMSConfig) SMSSender {
	switch cfg.Provider {
	case "fast2sms":
		return Fast2SMSSender{APIKey: cfg.APIKey}
	case "twilio":
		return TwilioSender{AccountSID: cfg.AccountSID, AuthToken: cfg.AuthToken, From: cfg.From}
	default:
		return LogSender{}
	}
}

// ── LogSender ─────────────────────────────────────────────────────────────────
// Prints OTPs to stdout. Use SMS_PROVIDER=log (the default) during development.

type LogSender struct{}

func (LogSender) Send(phone, message string) error {
	log.Printf("[SMS] to=%s  %s", phone, message)
	return nil
}

// ── Fast2SMSSender ────────────────────────────────────────────────────────────
// https://www.fast2sms.com  —  set SMS_PROVIDER=fast2sms, FAST2SMS_API_KEY=...

type Fast2SMSSender struct {
	APIKey string
}

func (s Fast2SMSSender) Send(phone, message string) error {
	// Fast2SMS expects a 10-digit Indian number (no country code)
	number := strings.TrimPrefix(phone, "+91")
	number = strings.TrimPrefix(number, "91")
	number = strings.TrimPrefix(number, "+")

	resp, err := http.PostForm("https://www.fast2sms.com/dev/bulkV2", url.Values{
		"authorization": {s.APIKey},
		"message":       {message},
		"language":      {"english"},
		"route":         {"q"},
		"numbers":       {number},
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("fast2sms: status %d — %s", resp.StatusCode, body)
	}
	return nil
}

// ── TwilioSender ──────────────────────────────────────────────────────────────
// https://www.twilio.com  —  set SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID=...,
//                            TWILIO_AUTH_TOKEN=..., TWILIO_FROM=+1XXXXXXXXXX

type TwilioSender struct {
	AccountSID string
	AuthToken  string
	From       string
}

func (s TwilioSender) Send(phone, message string) error {
	endpoint := fmt.Sprintf(
		"https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
		s.AccountSID,
	)
	req, err := http.NewRequest(http.MethodPost, endpoint,
		strings.NewReader(url.Values{
			"To":   {phone},
			"From": {s.From},
			"Body": {message},
		}.Encode()),
	)
	if err != nil {
		return err
	}
	req.SetBasicAuth(s.AccountSID, s.AuthToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("twilio: status %d — %s", resp.StatusCode, body)
	}
	return nil
}
