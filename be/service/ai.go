package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"example.com/config"
	"example.com/model"
)

var digitsRe = regexp.MustCompile(`\d+`)

type AIService struct {
	cfg *config.Config
}

func NewAI(cfg *config.Config) *AIService {
	return &AIService{cfg: cfg}
}

func (s *AIService) PickMove(ctx context.Context, req model.AIMoveRequest) (int, error) {
	prompt := buildAIPrompt(req)
	text, err := s.anthropicComplete(ctx, prompt, 8)
	if err != nil {
		return 0, err
	}
	if m := digitsRe.FindString(text); m != "" {
		if n, e := strconv.Atoi(m); e == nil && n >= 0 && n < len(req.ValidMoves) {
			return n, nil
		}
	}
	return 0, nil
}

func buildAIPrompt(req model.AIMoveRequest) string {
	var b strings.Builder
	fmt.Fprintf(&b, `You play "ACE", a South Indian card game. You are %s.

RULES:
- GOAL: Empty your hand first. Last player with cards LOSES.
- Rank: A(highest) K Q J 10 9 8 7 6 5 4 3 2(lowest)
- Leader plays any card -> sets the led suit
- Others MUST follow led suit if they have it
- No led-suit cards? You MUST cut (play any card) -> stops the round immediately
- After a cut: player with the HIGHEST led-suit card takes ALL played cards (bad!)
- No cut: highest led-suit player leads next; all cards discarded permanently

STRATEGY:
- Avoid holding the highest led-suit card when a cut is coming
- If someone after you is void in the led suit they will cut, so you can dump high cards safely
- When leading, lead a suit a later player is void in to trap the player before them
- Do not always play your lowest card

GAME STATE:
- Your hand: %s
- Led suit: %s
- Played this round: %s
- Players after you: %s
- Known voids: %s
- Card counts: %s
- Recent plays: %s

VALID MOVES:
`,
		req.Player,
		strings.Join(req.Hand, " "),
		orNone(req.LedSuit, "NONE (you lead)"),
		joinPlayed(req.RoundCards),
		orNone(strings.Join(req.PlayersAfter, ", "), "none (you are last)"),
		joinVoids(req.Voids),
		joinCounts(req.Counts),
		orNone(strings.Join(req.Recent, " "), "none"),
	)
	for i, m := range req.ValidMoves {
		fmt.Fprintf(&b, "%d: %s\n", i, m)
	}
	b.WriteString("\nReply with ONLY a single number (the move index). Nothing else.")
	return b.String()
}

func (s *AIService) anthropicComplete(ctx context.Context, prompt string, maxTokens int) (string, error) {
	if s.cfg.AnthropicKey == "" {
		return "", errors.New("no anthropic api key configured")
	}
	body, _ := json.Marshal(map[string]any{
		"model":      s.cfg.AIModel,
		"max_tokens": maxTokens,
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.cfg.AnthropicKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic status %d", res.StatusCode)
	}

	var out struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return "", err
	}
	if len(out.Content) == 0 {
		return "", errors.New("empty response")
	}
	return out.Content[0].Text, nil
}

func orNone(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}

func joinPlayed(cards []model.PlayedCard) string {
	if len(cards) == 0 {
		return "none"
	}
	parts := make([]string, len(cards))
	for i, c := range cards {
		parts[i] = c.Player + ":" + c.Card
	}
	return strings.Join(parts, " ")
}

func joinVoids(v map[string][]string) string {
	if len(v) == 0 {
		return "none"
	}
	var parts []string
	for name, suits := range v {
		parts = append(parts, name+" no "+strings.Join(suits, ""))
	}
	return strings.Join(parts, "; ")
}

func joinCounts(c map[string]int) string {
	if len(c) == 0 {
		return "n/a"
	}
	var parts []string
	for name, n := range c {
		parts = append(parts, fmt.Sprintf("%s:%d", name, n))
	}
	return strings.Join(parts, " ")
}
