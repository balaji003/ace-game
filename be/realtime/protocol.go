package realtime

import "example.com/model"

// Inbound message types (client → server).
const (
	MsgJoinQueue = "join_queue"
	MsgPlayCard  = "play_card"
	MsgImHere    = "im_here"
	MsgLeave     = "leave"
)

// Outbound message types (server → client).
const (
	MsgQueue      = "queue"
	MsgStart      = "start"
	MsgState      = "state"
	MsgPrompt     = "prompt"     // no-response popup for the stalling player
	MsgPeerIdle   = "peer_idle"  // "waiting for X" banner for everyone else
	MsgPlayerLeft = "player_left"
	MsgGameOver   = "game_over"
	MsgError      = "error"
)

// Inbound is a decoded client message. Only the fields relevant to Type are set.
type Inbound struct {
	Type      string `json:"type"`
	Opponents int    `json:"opponents"` // join_queue: number of opponents (total = opponents+1)
	Suit      string `json:"suit"`      // play_card
	Rank      string `json:"rank"`      // play_card
}

// GameRecorder lets a room persist results without importing the service layer
// directly (keeps the dependency one-way). *service.GameService satisfies it.
type GameRecorder interface {
	RecordGame(uid int64, req model.RecordGameRequest) (model.Stats, error)
}
