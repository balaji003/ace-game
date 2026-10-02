package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPrivacyServesCompletePage(t *testing.T) {
	rec := httptest.NewRecorder()
	Privacy(rec, httptest.NewRequest(http.MethodGet, "/privacy", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type = %q, want text/html", ct)
	}

	body := rec.Body.String()
	for _, want := range []string{
		"<!doctype html>",
		"<title>Privacy Policy · ACE</title>",
		`class="ace-policy-page"`,
		"Deleting your data", // content from the shared fragment
		".ace-policy .hl",    // rules from the shared stylesheet, inlined
	} {
		if !strings.Contains(body, want) {
			t.Errorf("page is missing %q", want)
		}
	}

	// Authoring notes must not reach readers of the published page.
	if strings.Contains(body, "<!--") || strings.Contains(body, "TODO") {
		t.Error("authoring comments leaked into the served page")
	}
}

// The in-app screen parses the version out of this same markup, so the span the
// parser looks for has to stay present and singular.
func TestPolicyVersionSpanIsParseable(t *testing.T) {
	if n := strings.Count(policyFragment, `class="ace-policy-version"`); n != 1 {
		t.Fatalf("found %d version spans, want exactly 1", n)
	}
}
