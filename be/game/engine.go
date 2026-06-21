// Package game is the authoritative ACE rules engine for online play.
// It is a 1:1 port of the client engine (fe/src/game/engine.js + fe/src/utils/deck.js)
// so server-validated online games behave identically to local offline games.
package game

import (
	"math/rand"
	"strconv"
)

// Suits and ranks mirror fe/src/constants.js exactly (order matters for rank value).
var Suits = []string{"♠", "♥", "♦", "♣"}
var Ranks = []string{"2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"}

// rankVal maps a rank to its comparable value (2 → 2 … A → 14), matching RANK_VAL.
var rankVal = func() map[string]int {
	m := make(map[string]int, len(Ranks))
	for i, r := range Ranks {
		m[r] = i + 2
	}
	return m
}()

type Card struct {
	Suit string `json:"suit"`
	Rank string `json:"rank"`
}

func (c Card) eq(o Card) bool { return c.Suit == o.Suit && c.Rank == o.Rank }

// Played is one card laid on the table this round by a given seat.
type Played struct {
	Player int  `json:"player"`
	Card   Card `json:"card"`
}

// Phase mirrors the client's 'playing' | 'result' | 'gameOver'.
const (
	PhasePlaying  = "playing"
	PhaseResult   = "result"
	PhaseGameOver = "gameOver"
)

// State is the full authoritative game state. Field names mirror engine.js.
type State struct {
	Hands       [][]Card `json:"hands"`
	N           int      `json:"n"`
	RoundCards  []Played `json:"roundCards"`
	LedSuit     string   `json:"ledSuit"`
	Leader      int      `json:"leader"`
	RoundOrder  []int    `json:"roundOrder"`
	TurnIdx     int      `json:"turnIdx"`
	Finished    []int    `json:"finished"`
	Removed     []int    `json:"removed"` // seats pushed out (timeout/leave) — excluded from play, recorded as a loss
	Log         []string `json:"log"`
	Phase       string   `json:"phase"`
	SuitVoids   [][]string `json:"suitVoids"`
	RoundHistory []Played `json:"roundHistory"`
	ResultMsg   string   `json:"resultMsg"`
	ResultType  string   `json:"resultType"` // 'dead' | 'cut'
	NextLeader  int      `json:"nextLeader"`
	Loser       *int     `json:"loser"`
}

// Names are the canonical seat labels used only for log lines. The client
// renders its own you-centric names; logs are cosmetic.
var Names = []string{"P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"}

func name(i int) string {
	if i >= 0 && i < len(Names) {
		return Names[i]
	}
	return "P?"
}

// shuffle returns a shuffled copy (Fisher–Yates), mirroring deck.js shuffle.
func shuffle(deck []Card, rng *rand.Rand) []Card {
	b := append([]Card(nil), deck...)
	for i := len(b) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		b[i], b[j] = b[j], b[i]
	}
	return b
}

// Deal builds a 52-card deck, shuffles it, and round-robins into n hands.
func Deal(n int, rng *rand.Rand) [][]Card {
	deck := make([]Card, 0, 52)
	for _, s := range Suits {
		for _, r := range Ranks {
			deck = append(deck, Card{Suit: s, Rank: r})
		}
	}
	deck = shuffle(deck, rng)
	hands := make([][]Card, n)
	for i := range hands {
		hands[i] = []Card{}
	}
	for i, c := range deck {
		hands[i%n] = append(hands[i%n], c)
	}
	return hands
}

// FindStarter returns the seat holding A♠ (they lead first).
func FindStarter(hands [][]Card) int {
	for i, h := range hands {
		for _, c := range h {
			if c.Suit == "♠" && c.Rank == "A" {
				return i
			}
		}
	}
	return 0
}

// GetRoundOrder lists active seats in play order starting from leader.
func GetRoundOrder(leader, n int, finished []int) []int {
	order := make([]int, 0, n)
	for i := 0; i < n; i++ {
		p := (leader + i) % n
		if !contains(finished, p) {
			order = append(order, p)
		}
	}
	return order
}

// HighestOf returns the played entry with the highest rank in the given suit.
func HighestOf(played []Played, suit string) *Played {
	var best *Played
	for i := range played {
		p := played[i]
		if p.Card.Suit != suit {
			continue
		}
		if best == nil || rankVal[p.Card.Rank] > rankVal[best.Card.Rank] {
			b := p
			best = &b
		}
	}
	return best
}

// LegalMoves returns the cards a seat may play this turn (follow suit if able).
func LegalMoves(s *State, seat int) []Card {
	hand := s.Hands[seat]
	if s.LedSuit == "" {
		return append([]Card(nil), hand...)
	}
	var suited []Card
	for _, c := range hand {
		if c.Suit == s.LedSuit {
			suited = append(suited, c)
		}
	}
	if len(suited) > 0 {
		return suited
	}
	return append([]Card(nil), hand...)
}

// InitGame deals and builds the opening state, mirroring initGame.
func InitGame(n int, rng *rand.Rand) *State {
	hands := Deal(n, rng)
	starter := FindStarter(hands)
	voids := make([][]string, n)
	for i := range voids {
		voids[i] = []string{}
	}
	return &State{
		Hands:        hands,
		N:            n,
		RoundCards:   []Played{},
		LedSuit:      "",
		Leader:       starter,
		RoundOrder:   GetRoundOrder(starter, n, nil),
		TurnIdx:      0,
		Finished:     []int{},
		Removed:      []int{},
		Log:          []string{name(starter) + " has A♠ — starts!"},
		Phase:        PhasePlaying,
		SuitVoids:    voids,
		RoundHistory: []Played{},
		NextLeader:   -1,
		Loser:        nil,
	}
}

// CurrentSeat returns whose turn it is, or -1 when not in the playing phase.
func (s *State) CurrentSeat() int {
	if s.Phase != PhasePlaying || s.TurnIdx >= len(s.RoundOrder) {
		return -1
	}
	return s.RoundOrder[s.TurnIdx]
}

// ApplyPlay performs the core transition: seat plays card. It mutates and
// returns s. Invalid moves are ignored (state returned unchanged), matching
// the guard behavior of applyPlay in engine.js.
func ApplyPlay(s *State, seat int, card Card) *State {
	if s.Phase != PhasePlaying {
		return s
	}
	if s.CurrentSeat() != seat {
		return s
	}
	// Must follow suit if able.
	if s.LedSuit != "" && card.Suit != s.LedSuit && handHasSuit(s.Hands[seat], s.LedSuit) {
		return s
	}
	// Card must actually be in hand.
	if !handHasCard(s.Hands[seat], card) {
		return s
	}

	newLed := s.LedSuit
	if newLed == "" {
		newLed = card.Suit
	}
	// Remove the played card from the seat's hand.
	s.Hands[seat] = removeCard(s.Hands[seat], card)
	s.RoundCards = append(s.RoundCards, Played{Player: seat, Card: card})

	isCut := s.LedSuit != "" && card.Suit != s.LedSuit
	if isCut {
		s.SuitVoids[seat] = addUnique(s.SuitVoids[seat], s.LedSuit)
		s.Log = append(s.Log, "✂️ "+name(seat)+" cuts with "+card.Rank+card.Suit+"!")
	} else {
		s.Log = append(s.Log, name(seat)+" plays "+card.Rank+card.Suit)
	}

	if len(s.Hands[seat]) == 0 && !contains(s.Finished, seat) {
		s.Finished = append(s.Finished, seat)
		s.Log = append(s.Log, "🎉 "+name(seat)+" finished! (#"+strconv.Itoa(len(s.Finished))+")")
	}

	isLastInRound := s.TurnIdx == len(s.RoundOrder)-1

	// Mid-round: advance to the next player.
	if !isCut && !isLastInRound {
		s.LedSuit = newLed
		s.TurnIdx++
		return s
	}

	// Round ends (a cut, or everyone has played). Resolve the trick.
	s.LedSuit = newLed
	resolveTrick(s)
	return s
}

// resolveTrick settles the current trick: a cut sends the pile to the highest
// led-suit holder; otherwise the cards go dead and that holder leads next.
// Sets the result phase and the loser if the game has effectively ended.
// Shared by ApplyPlay and Forfeit.
func resolveTrick(s *State) {
	highest := HighestOf(s.RoundCards, s.LedSuit)
	isCut := false
	for _, rc := range s.RoundCards {
		if rc.Card.Suit != s.LedSuit {
			isCut = true
			break
		}
	}

	if isCut && highest != nil {
		taker := highest.Player
		taken := make([]Card, 0, len(s.RoundCards))
		for _, rc := range s.RoundCards {
			taken = append(taken, rc.Card)
		}
		s.Hands[taker] = append(s.Hands[taker], taken...)
		s.Finished = removeInt(s.Finished, taker)
		s.NextLeader = taker
		s.ResultMsg = "✂️ CUT! " + name(taker) + " held " + highest.Card.Rank + highest.Card.Suit + " — takes " + strconv.Itoa(len(taken)) + " cards!"
		s.ResultType = "cut"
		s.Log = append(s.Log, s.ResultMsg)
	} else {
		leader := s.Leader
		if highest != nil {
			leader = highest.Player
		}
		s.NextLeader = leader
		s.ResultMsg = "💀 Cards go DEAD. " + name(leader) + " leads next round."
		s.ResultType = "dead"
		s.Log = append(s.Log, s.ResultMsg)
	}

	s.RoundHistory = append(s.RoundHistory, s.RoundCards...)
	s.setTerminalLoser()
	s.Phase = PhaseResult
}

// setTerminalLoser decides the loser once the game can no longer continue
// (≤1 active player). Classic ACE: the last player holding cards loses — but
// that only applies when the field thinned through natural finishing. If any
// player was removed (forfeit/timeout), the lone survivor WINS instead and
// there is no card-holder loser; the removed players are the losses.
func (s *State) setTerminalLoser() {
	if active := s.active(); len(active) == 1 && len(s.Removed) == 0 {
		l := active[0]
		s.Loser = &l
		s.Log = append(s.Log, "🏴 "+name(l)+" LOSES!")
		return
	}
	s.Loser = nil
}

// Forfeit removes a seat mid-game (no-response burn or explicit leave): their
// remaining cards leave play and they're excluded from all future rounds. The
// burn fires on the current player, so the removed seat has not yet played the
// in-progress trick. Handles the three positions cleanly:
//   - more players still to act this trick → turn passes to the next seat
//   - removed seat was the last to act     → the trick resolves now (dead)
//   - only one active player remains        → game over (that player loses)
// A forfeited player is recorded as a loss by the caller (see room.finishGame).
func Forfeit(s *State, seat int) {
	if contains(s.Removed, seat) || s.Phase == PhaseGameOver {
		return
	}
	s.Removed = append(s.Removed, seat)
	s.Hands[seat] = nil // their cards leave the game
	s.Log = append(s.Log, "🚪 "+name(seat)+" removed from the game.")

	if idx := indexOf(s.RoundOrder, seat); idx >= 0 {
		wasLast := idx == len(s.RoundOrder)-1
		s.RoundOrder = removeInt(s.RoundOrder, seat)
		if idx < s.TurnIdx {
			s.TurnIdx-- // keep pointing at the same in-progress player
		}
		if s.Phase == PhasePlaying && wasLast && len(s.RoundCards) > 0 {
			resolveTrick(s) // everyone else already played → settle the trick
		}
	}

	if s.Phase == PhasePlaying {
		if s.TurnIdx >= len(s.RoundOrder) {
			s.TurnIdx = 0
		}
		if len(s.active()) <= 1 {
			s.setTerminalLoser()
			s.Phase = PhaseGameOver
			s.RoundCards = nil
		}
	}
}

// ResolveRound advances past the result pause to the next round (or gameOver),
// mirroring resolveRound in engine.js.
func ResolveRound(s *State) *State {
	if len(s.active()) <= 1 {
		s.setTerminalLoser()
		s.Phase = PhaseGameOver
		s.RoundCards = []Played{}
		return s
	}

	s.RoundCards = []Played{}
	s.LedSuit = ""
	s.Leader = s.NextLeader
	s.RoundOrder = GetRoundOrder(s.NextLeader, s.N, s.excluded())
	s.TurnIdx = 0
	s.Phase = PhasePlaying
	s.ResultMsg = ""
	s.ResultType = ""
	s.NextLeader = -1
	return s
}

// --- small helpers ---

// excluded returns every seat that is out of rotation (finished or removed).
func (s *State) excluded() []int {
	out := make([]int, 0, len(s.Finished)+len(s.Removed))
	out = append(out, s.Finished...)
	out = append(out, s.Removed...)
	return out
}

// active returns the seats still in the game (not finished, not removed).
func (s *State) active() []int {
	excl := s.excluded()
	out := make([]int, 0, s.N)
	for i := 0; i < s.N; i++ {
		if !contains(excl, i) {
			out = append(out, i)
		}
	}
	return out
}

func indexOf(xs []int, v int) int {
	for i, x := range xs {
		if x == v {
			return i
		}
	}
	return -1
}

func contains(xs []int, v int) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}

func removeInt(xs []int, v int) []int {
	out := make([]int, 0, len(xs))
	for _, x := range xs {
		if x != v {
			out = append(out, x)
		}
	}
	return out
}

func handHasSuit(hand []Card, suit string) bool {
	for _, c := range hand {
		if c.Suit == suit {
			return true
		}
	}
	return false
}

func handHasCard(hand []Card, card Card) bool {
	for _, c := range hand {
		if c.eq(card) {
			return true
		}
	}
	return false
}

func removeCard(hand []Card, card Card) []Card {
	out := make([]Card, 0, len(hand))
	removed := false
	for _, c := range hand {
		if !removed && c.eq(card) {
			removed = true
			continue
		}
		out = append(out, c)
	}
	return out
}

func addUnique(xs []string, v string) []string {
	for _, x := range xs {
		if x == v {
			return xs
		}
	}
	return append(append([]string(nil), xs...), v)
}
