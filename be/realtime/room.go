package realtime

import (
	"math/rand"
	"time"

	"example.com/game"
	"example.com/model"
)

const resultDelay = 2500 * time.Millisecond // matches the client's result animation pause

type evType int

const (
	evPlay evType = iota
	evLeave
	evDisconnect
	evReconnect
	evIdle    // idle timer fired → show the "are you there?" prompt
	evGrace   // grace timer fired with no response → burn
	evImHere  // player clicked "I am here"
	evResolve // result pause elapsed → advance round
)

type roomEvent struct {
	typ    evType
	client *Client
	card   game.Card
	gen    int // generation guard for timer events
}

// Player is one seat in a room.
type Player struct {
	uid       int64
	username  string
	seat      int
	client    *Client
	connected bool
	out       bool // burned / forfeited
}

// Room owns one game's authoritative state. All mutations happen in run().
type Room struct {
	id      string
	hub     *Hub
	players []*Player
	state   *game.State
	cfg     HubConfig
	rec     GameRecorder

	events chan roomEvent
	quit   chan struct{}

	turnGen     int
	retriesUsed int  // "I am here" clicks consumed this turn
	prompting   bool // currently showing the no-response prompt
	done        bool
}

func newRoom(id string, hub *Hub, members []*Client, cfg HubConfig, rec GameRecorder) *Room {
	players := make([]*Player, len(members))
	for i, c := range members {
		players[i] = &Player{uid: c.uid, username: c.username, seat: i, client: c, connected: true}
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	return &Room{
		id:      id,
		hub:     hub,
		players: players,
		state:   game.InitGame(len(members), rng),
		cfg:     cfg,
		rec:     rec,
		events:  make(chan roomEvent, 64),
		quit:    make(chan struct{}),
	}
}

// --- external entry points (called from hub / timer goroutines) ---

func (r *Room) start() {
	go r.run()
	r.sendStart()
	r.broadcastState()
	r.armTurn()
}

func (r *Room) play(c *Client, suit, rank string) {
	r.post(roomEvent{typ: evPlay, client: c, card: game.Card{Suit: suit, Rank: rank}})
}
func (r *Room) leave(c *Client)      { r.post(roomEvent{typ: evLeave, client: c}) }
func (r *Room) disconnect(c *Client) { r.post(roomEvent{typ: evDisconnect, client: c}) }
func (r *Room) reconnect(c *Client)  { r.post(roomEvent{typ: evReconnect, client: c}) }
func (r *Room) imHere(c *Client)     { r.post(roomEvent{typ: evImHere, client: c}) }

func (r *Room) post(ev roomEvent) {
	select {
	case r.events <- ev:
	case <-r.quit:
	}
}

func (r *Room) run() {
	for ev := range r.events {
		r.handle(ev)
		if r.done {
			close(r.quit)
			return
		}
	}
}

// --- event handling ---

func (r *Room) handle(ev roomEvent) {
	switch ev.typ {
	case evPlay:
		r.onPlay(ev.client, ev.card)
	case evResolve:
		r.onResolve()
	case evIdle:
		r.onIdle(ev.gen)
	case evGrace:
		r.onGrace(ev.gen)
	case evImHere:
		r.onImHere(ev.client)
	case evDisconnect:
		r.onDisconnect(ev.client)
	case evReconnect:
		r.onReconnect(ev.client)
	case evLeave:
		if p := r.playerOf(ev.client); p != nil {
			r.forfeit(p.seat, "left")
		}
	}
}

func (r *Room) onPlay(c *Client, card game.Card) {
	p := r.playerOf(c)
	if p == nil || r.state.Phase != game.PhasePlaying {
		return
	}
	if r.state.CurrentSeat() != p.seat {
		c.sendMsg(MsgError, map[string]any{"msg": "not your turn"})
		return
	}
	before := r.state.Phase
	prevLen := len(r.state.RoundCards)
	game.ApplyPlay(r.state, p.seat, card)
	if len(r.state.RoundCards) == prevLen && r.state.Phase == before {
		// Nothing changed → illegal move rejected by the engine.
		c.sendMsg(MsgError, map[string]any{"msg": "illegal move"})
		return
	}

	r.clearPrompt() // a move clears any pending no-response prompt
	r.broadcastState()

	switch r.state.Phase {
	case game.PhaseResult:
		r.stopTurn()
		r.scheduleAfter(resultDelay, func(gen int) roomEvent { return roomEvent{typ: evResolve} })
	case game.PhaseGameOver:
		r.finishGame()
	default:
		r.armTurn() // next player's turn
	}
}

func (r *Room) onResolve() {
	if r.state.Phase != game.PhaseResult {
		return
	}
	game.ResolveRound(r.state)
	r.broadcastState()
	if r.state.Phase == game.PhaseGameOver {
		r.finishGame()
		return
	}
	r.armTurn()
}

// onIdle fires once the current player has been idle too long: it shows the
// "are you there?" prompt and starts the grace countdown.
func (r *Room) onIdle(gen int) {
	if gen != r.turnGen || r.state.Phase != game.PhasePlaying {
		return
	}
	if r.state.CurrentSeat() < 0 {
		return
	}
	r.prompting = true
	r.sendPrompt()
	r.scheduleAfter(time.Duration(r.cfg.GraceSecs)*time.Second,
		func(gen int) roomEvent { return roomEvent{typ: evGrace, gen: gen} })
}

// onGrace fires when the grace countdown elapses with no response → burn.
func (r *Room) onGrace(gen int) {
	if gen != r.turnGen || !r.prompting || r.state.Phase != game.PhasePlaying {
		return
	}
	seat := r.state.CurrentSeat()
	if seat < 0 {
		return
	}
	r.forfeit(seat, "timeout")
}

// onImHere consumes one retry. Each click buys another grace period, up to
// MaxRetries; the click past the cap (or any unanswered grace) burns the seat.
func (r *Room) onImHere(c *Client) {
	p := r.playerOf(c)
	if p == nil || !r.prompting || r.state.CurrentSeat() != p.seat {
		return
	}
	r.retriesUsed++
	if r.retriesUsed > r.cfg.MaxRetries {
		r.forfeit(p.seat, "timeout")
		return
	}
	r.turnGen++ // invalidate the pending grace timer, then re-arm a fresh one
	r.sendPrompt()
	r.scheduleAfter(time.Duration(r.cfg.GraceSecs)*time.Second,
		func(gen int) roomEvent { return roomEvent{typ: evGrace, gen: gen} })
}

func (r *Room) onDisconnect(c *Client) {
	p := r.playerOf(c)
	if p == nil || p.client != c {
		return // stale (already replaced by a reconnect)
	}
	p.connected = false
	p.client = nil
	// Seat is held; if it's their turn the warning timer is already running and
	// will burn them if they don't return. Nothing else to do here.
}

func (r *Room) onReconnect(c *Client) {
	p := r.playerForUID(c.uid)
	if p == nil || p.out {
		c.sendMsg(MsgError, map[string]any{"msg": "no active game to rejoin"})
		return
	}
	p.client = c
	p.connected = true
	c.setRoom(r)
	r.sendStartTo(p)
	r.sendStateTo(p)
	if r.prompting {
		r.sendPrompt() // re-show the no-response prompt/banner after a reconnect
	}
}

// --- turn timer ---

func (r *Room) armTurn() {
	if r.state.Phase != game.PhasePlaying {
		return
	}
	r.turnGen++
	r.retriesUsed = 0
	r.prompting = false
	r.scheduleAfter(time.Duration(r.cfg.WarnSecs)*time.Second,
		func(gen int) roomEvent { return roomEvent{typ: evIdle, gen: gen} })
}

func (r *Room) stopTurn() { r.turnGen++ } // invalidate any pending timers

// sendPrompt shows the no-response popup to the current player and a "waiting
// for X" banner to everyone else.
func (r *Room) sendPrompt() {
	seat := r.state.CurrentSeat()
	if seat < 0 {
		return
	}
	triesLeft := r.cfg.MaxRetries - r.retriesUsed
	last := triesLeft <= 0
	for _, p := range r.players {
		if p.client == nil {
			continue
		}
		if p.seat == seat {
			p.client.sendMsg(MsgPrompt, map[string]any{
				"active": true, "triesLeft": triesLeft, "last": last, "secondsLeft": r.cfg.GraceSecs,
			})
		} else {
			p.client.sendMsg(MsgPeerIdle, map[string]any{
				"active": true, "seat": r.display(p.seat, seat), "secondsLeft": r.cfg.GraceSecs,
			})
		}
	}
}

// clearPrompt hides any prompt/peer banner for all players.
func (r *Room) clearPrompt() {
	if !r.prompting {
		return
	}
	r.prompting = false
	for _, p := range r.players {
		if p.client == nil {
			continue
		}
		p.client.sendMsg(MsgPrompt, map[string]any{"active": false})
		p.client.sendMsg(MsgPeerIdle, map[string]any{"active": false})
	}
}

// scheduleAfter posts an event after d. The builder receives the generation
// captured at scheduling time so stale ticks can be ignored.
func (r *Room) scheduleAfter(d time.Duration, build func(gen int) roomEvent) {
	gen := r.turnGen
	time.AfterFunc(d, func() { r.post(build(gen)) })
}

// --- forfeit / game over ---

// forfeit burns a seat's hand and pushes them out, delegating the rules (turn
// hand-off, trick resolution, game-over detection) to the authoritative engine.
// Works for any room size: with >2 players the game continues among the rest.
func (r *Room) forfeit(seat int, reason string) {
	p := r.players[seat]
	if p.out || r.done {
		return
	}
	p.out = true
	r.stopTurn()
	r.clearPrompt() // hide any lingering prompt/peer banners
	r.broadcastPlayerLeft(seat, reason)

	game.Forfeit(r.state, seat)
	r.broadcastState()

	switch r.state.Phase {
	case game.PhaseGameOver:
		r.finishGame()
	case game.PhaseResult:
		r.scheduleAfter(resultDelay, func(int) roomEvent { return roomEvent{typ: evResolve} })
	default:
		r.armTurn() // play continues with the next seat
	}
}

func (r *Room) finishGame() {
	if r.done {
		return
	}
	r.done = true
	r.stopTurn()

	loserSeat := -1
	if r.state.Loser != nil {
		loserSeat = *r.state.Loser
	}

	// Broadcast game_over (loser as each recipient's display index) and record stats.
	for _, p := range r.players {
		if p.client != nil {
			p.client.sendMsg(MsgGameOver, map[string]any{
				"loserSeat": r.display(p.seat, loserSeat),
				"youLost":   r.isLoss(p, loserSeat),
			})
			p.client.setRoom(nil)
		}
		r.recordResult(p, loserSeat)
	}
	r.hub.closeRoom(r)
}

// isLoss reports whether a player ends the game as a loser: the final
// card-holder, or anyone pushed out (forfeit/timeout). Everyone else wins.
func (r *Room) isLoss(p *Player, loserSeat int) bool {
	return p.out || p.seat == loserSeat
}

func (r *Room) recordResult(p *Player, loserSeat int) {
	if r.rec == nil {
		return
	}
	won := !r.isLoss(p, loserSeat)
	// Placement: finishers ranked by finish order; losers/removed at the bottom.
	placement := len(r.players)
	for i, f := range r.state.Finished {
		if f == p.seat {
			placement = i + 1
		}
	}
	opps := make([]string, 0, len(r.players)-1)
	for _, o := range r.players {
		if o.seat != p.seat {
			opps = append(opps, o.username)
		}
	}
	if _, err := r.rec.RecordGame(p.uid, model.RecordGameRequest{
		Won: won, Placement: placement, Mode: "online", Opponents: opps,
	}); err != nil {
		logf("record game uid=%d: %v", p.uid, err)
	}
}

// --- broadcasting / perspective ---

func (r *Room) sendStart() {
	for _, p := range r.players {
		r.sendStartTo(p)
	}
}

func (r *Room) sendStartTo(p *Player) {
	if p.client == nil {
		return
	}
	p.client.sendMsg(MsgStart, map[string]any{
		"you":   0,
		"n":     len(r.players),
		"names": r.namesFor(p.seat),
	})
}

func (r *Room) broadcastState() {
	for _, p := range r.players {
		r.sendStateTo(p)
	}
}

func (r *Room) sendStateTo(p *Player) {
	if p.client == nil {
		return
	}
	p.client.sendMsg(MsgState, r.perspective(p.seat))
}

func (r *Room) broadcastPlayerLeft(seat int, reason string) {
	for _, p := range r.players {
		if p.client == nil {
			continue
		}
		p.client.sendMsg(MsgPlayerLeft, map[string]any{
			"seat":   r.display(p.seat, seat),
			"isYou":  p.seat == seat,
			"reason": reason,
		})
	}
}

// perspective builds a you-centric view: the recipient's seat becomes display
// index 0, others rotate around. Only the recipient's own hand is revealed.
func (r *Room) perspective(me int) map[string]any {
	n := len(r.players)
	s := r.state

	handCounts := make([]int, n)
	for d := 0; d < n; d++ {
		handCounts[d] = len(s.Hands[r.canonical(me, d)])
	}

	roundCards := make([]map[string]any, 0, len(s.RoundCards))
	for _, rc := range s.RoundCards {
		roundCards = append(roundCards, map[string]any{
			"player": r.display(me, rc.Player),
			"card":   rc.Card,
		})
	}

	finished := make([]int, 0, len(s.Finished))
	for _, f := range s.Finished {
		finished = append(finished, r.display(me, f))
	}

	turn := s.CurrentSeat()
	if turn >= 0 {
		turn = r.display(me, turn)
	}

	nextLeader := -1
	if s.NextLeader >= 0 {
		nextLeader = r.display(me, s.NextLeader)
	}

	return map[string]any{
		"n":          n,
		"phase":      s.Phase,
		"ledSuit":    s.LedSuit,
		"turn":       turn,
		"leader":     r.display(me, s.Leader),
		"nextLeader": nextLeader,
		"resultMsg":  s.ResultMsg,
		"resultType": s.ResultType,
		"hand":       s.Hands[me],
		"handCounts": handCounts,
		"roundCards": roundCards,
		"finished":   finished,
		"names":      r.namesFor(me),
		"loser":      r.displayLoser(me),
	}
}

func (r *Room) displayLoser(me int) any {
	if r.state.Loser == nil {
		return nil
	}
	return r.display(me, *r.state.Loser)
}

// namesFor returns usernames ordered by the recipient's display index
// (index 0 = recipient). Burned players are marked.
func (r *Room) namesFor(me int) []string {
	n := len(r.players)
	names := make([]string, n)
	for d := 0; d < n; d++ {
		p := r.players[r.canonical(me, d)]
		label := p.username
		if p.out {
			label += " (out)"
		}
		names[d] = label
	}
	return names
}

// display maps a canonical seat to the display index seen by viewer `me`.
func (r *Room) display(me, seat int) int {
	n := len(r.players)
	return ((seat-me)%n + n) % n
}

// canonical maps a display index (for viewer `me`) back to the canonical seat.
func (r *Room) canonical(me, d int) int {
	n := len(r.players)
	return (d + me) % n
}

func (r *Room) playerOf(c *Client) *Player {
	for _, p := range r.players {
		if p.client == c {
			return p
		}
	}
	return nil
}

func (r *Room) playerForUID(uid int64) *Player {
	for _, p := range r.players {
		if p.uid == uid {
			return p
		}
	}
	return nil
}

