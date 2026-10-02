// Package web serves the public, human-readable pages the app cannot host
// itself — currently the privacy policy, which Google Play requires to be
// reachable on the open web without installing the app.
//
// privacy-policy.html and privacy-policy.css are the SAME files the in-app
// screen imports (fe/src/screens/PrivacyPolicy.jsx raw-imports them at build
// time), so the public page and the in-app page cannot drift apart.
package web

import (
	_ "embed"
	"net/http"
	"regexp"
)

//go:embed privacy-policy.html
var policyFragment string

//go:embed privacy-policy.css
var policyCSS string

// Authoring comments (including the contact-address TODO) are for the repo, not
// for readers of the published page.
var commentRE = regexp.MustCompile(`(?s)<!--.*?-->`)

// policyPage is the standalone document served at /privacy. The stylesheet is
// inlined so the page is one request with no external dependencies — it renders
// even if nothing else of ours is reachable.
var policyPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Privacy Policy · ACE</title>
<style>` + policyCSS + `</style>
</head>
<body style="margin:0">
<div class="ace-policy-page">` + commentRE.ReplaceAllString(policyFragment, "") + `</div>
</body>
</html>
`

// Privacy serves the policy as a complete HTML page.
func Privacy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write([]byte(policyPage))
}
