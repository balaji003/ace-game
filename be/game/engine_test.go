package game

import (
	"math/rand"
	"testing"
)

func TestDealProducesFullDeck(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	hands := Deal(4, rng)
	total := 0
	seen := map[string]bool{}
	for _, h := range hands {
		for _, c := range h {
			total++
			key := c.Suit + c.Rank
			if seen[key] {
				t.Fatalf("duplicate card dealt: %s", key)
			}
			seen[key] = true
		}
	}
	if total != 52 {
		t.Fatalf("expected 52 cards dealt, got %d", total)
	}
}

func TestStarterHoldsAceOfSpades(t *testing.T) {
	rng := rand.New(rand.NewSource(2))
	s := InitGame(4, rng)
	starter := s.Leader
	has := false
	for _, c := range s.Hands[starter] {
		if c.Suit == "♠" && c.Rank == "A" {
			has = true
		}
	}
	if !has {
		t.Fatalf("starter seat %d does not hold A♠", starter)
	}
	if s.CurrentSeat() != starter {
		t.Fatalf("current seat %d != starter %d", s.CurrentSeat(), starter)
	}
}

func TestFollowSuitEnforced(t *testing.T) {
	// Hand the leader a known state and verify an off-suit play is rejected
	// while a legal follow is accepted.
	s := &State{
		N:          2,
		Hands:      [][]Card{{{"♠", "A"}, {"♠", "5"}}, {{"♠", "K"}, {"♥", "2"}}},
		RoundCards: []Played{},
		Leader:     0,
		RoundOrder: []int{0, 1},
		TurnIdx:    0,
		Finished:   []int{},
		SuitVoids:  [][]string{{}, {}},
		Phase:      PhasePlaying,
		NextLeader: -1,
	}
	ApplyPlay(s, 0, Card{"♠", "A"}) // leader leads A♠
	if s.LedSuit != "♠" {
		t.Fatalf("led suit should be ♠, got %q", s.LedSuit)
	}
	// Seat 1 holds a ♠ → must follow. An off-suit ♥ play must be rejected.
	before := len(s.RoundCards)
	ApplyPlay(s, 1, Card{"♥", "2"})
	if len(s.RoundCards) != before {
		t.Fatalf("off-suit play should have been rejected while holding the led suit")
	}
	// Legal follow with K♠ resolves the round; A♠ is highest so seat 0 leads next (dead).
	ApplyPlay(s, 1, Card{"♠", "K"})
	if s.Phase != PhaseResult {
		t.Fatalf("expected result phase after both played, got %q", s.Phase)
	}
	if s.ResultType != "dead" || s.NextLeader != 0 {
		t.Fatalf("expected dead pile won by seat 0, got type=%q next=%d", s.ResultType, s.NextLeader)
	}
}

func TestCutTakesPile(t *testing.T) {
	s := &State{
		N:          2,
		Hands:      [][]Card{{{"♠", "A"}, {"♦", "3"}}, {{"♥", "9"}, {"♦", "2"}}},
		RoundCards: []Played{},
		Leader:     0,
		RoundOrder: []int{0, 1},
		TurnIdx:    0,
		Finished:   []int{},
		SuitVoids:  [][]string{{}, {}},
		Phase:      PhasePlaying,
		NextLeader: -1,
	}
	ApplyPlay(s, 0, Card{"♠", "A"}) // lead ♠
	ApplyPlay(s, 1, Card{"♥", "9"}) // seat 1 has no ♠ → cuts with ♥
	if s.Phase != PhaseResult || s.ResultType != "cut" {
		t.Fatalf("expected a cut result, got phase=%q type=%q", s.Phase, s.ResultType)
	}
	// A cut forces the holder of the highest LED-suit card (seat 0, A♠) to take
	// the pile and lead next — not the cutter.
	if s.NextLeader != 0 {
		t.Fatalf("highest led-suit holder (seat 0) should take the pile and lead, got %d", s.NextLeader)
	}
	// Seat 0 had 1 card left after leading, plus the 2 taken = 3 cards.
	if len(s.Hands[0]) != 3 {
		t.Fatalf("taker should hold 3 cards after taking the pile, got %d", len(s.Hands[0]))
	}
}

func TestForfeitMidTrickContinuesWith3Players(t *testing.T) {
	// 3 players, fresh round, seat 0 leads. Seat 1 gets forfeited mid-trick
	// (before playing) → turn should pass to seat 2, game continues.
	s := &State{
		N:          3,
		Hands:      [][]Card{{{"♠", "A"}, {"♠", "2"}}, {{"♠", "K"}, {"♥", "3"}}, {{"♠", "Q"}, {"♦", "4"}}},
		RoundCards: []Played{},
		Leader:     0,
		RoundOrder: []int{0, 1, 2},
		TurnIdx:    0,
		Finished:   []int{},
		Removed:    []int{},
		SuitVoids:  [][]string{{}, {}, {}},
		Phase:      PhasePlaying,
		NextLeader: -1,
	}
	ApplyPlay(s, 0, Card{"♠", "A"}) // seat 0 leads ♠A, turn → seat 1
	if s.CurrentSeat() != 1 {
		t.Fatalf("expected seat 1's turn, got %d", s.CurrentSeat())
	}
	Forfeit(s, 1) // seat 1 burned before playing
	if s.Phase != PhasePlaying {
		t.Fatalf("game should continue (3→2 active), phase=%q", s.Phase)
	}
	if s.CurrentSeat() != 2 {
		t.Fatalf("turn should pass to seat 2 after forfeit, got %d", s.CurrentSeat())
	}
	if indexOf(s.Removed, 1) < 0 || len(s.Hands[1]) != 0 {
		t.Fatalf("seat 1 should be removed with no cards; removed=%v hand=%d", s.Removed, len(s.Hands[1]))
	}
}

func TestForfeitLastActorResolvesTrick(t *testing.T) {
	// 3 players; seats 0 and 2 follow, then last actor (seat 1) is forfeited →
	// the trick resolves (dead) with the two played cards, highest leads next.
	s := &State{
		N:          3,
		Hands:      [][]Card{{{"♠", "A"}, {"♠", "2"}}, {{"♠", "K"}, {"♥", "3"}}, {{"♠", "5"}, {"♦", "4"}}},
		RoundCards: []Played{},
		Leader:     0,
		RoundOrder: []int{0, 2, 1}, // seat 1 acts last
		TurnIdx:    0,
		Finished:   []int{},
		Removed:    []int{},
		SuitVoids:  [][]string{{}, {}, {}},
		Phase:      PhasePlaying,
		NextLeader: -1,
	}
	ApplyPlay(s, 0, Card{"♠", "A"}) // turn → seat 2
	ApplyPlay(s, 2, Card{"♠", "5"}) // turn → seat 1 (last)
	Forfeit(s, 1)                   // last actor burned → trick resolves now
	if s.Phase != PhaseResult {
		t.Fatalf("expected result phase after last actor forfeited, got %q", s.Phase)
	}
	if s.ResultType != "dead" || s.NextLeader != 0 {
		t.Fatalf("expected dead trick led by seat 0 (A♠ highest), got type=%q next=%d", s.ResultType, s.NextLeader)
	}
}

func TestForfeitDownToOneEndsGame(t *testing.T) {
	// 2 active players; forfeiting one ends the game with the other as winner.
	s := &State{
		N:          2,
		Hands:      [][]Card{{{"♠", "A"}}, {{"♠", "K"}}},
		RoundCards: []Played{},
		Leader:     0,
		RoundOrder: []int{0, 1},
		TurnIdx:    0,
		Finished:   []int{},
		Removed:    []int{},
		SuitVoids:  [][]string{{}, {}},
		Phase:      PhasePlaying,
		NextLeader: -1,
	}
	Forfeit(s, 0)
	if s.Phase != PhaseGameOver {
		t.Fatalf("expected game over, got %q", s.Phase)
	}
	// Seat 0 forfeited → seat 1 WINS (opponent quit). No card-holder loser.
	if s.Loser != nil {
		t.Fatalf("survivor should win after opponent forfeits; Loser should be nil, got %v", *s.Loser)
	}
	if indexOf(s.Removed, 0) < 0 {
		t.Fatalf("seat 0 should be in Removed, got %v", s.Removed)
	}
}
