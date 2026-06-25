package realtime

import "example.com/model"

// Inbound message types (client → server).
const (
	MsgJoinQueue  = "join_queue"
	MsgCreateRoom = "create_room" // open a private room and wait for friends by code
	MsgJoinRoom   = "join_room"   // join a private room by its code
	MsgPlayCard   = "play_card"
	MsgImHere     = "im_here"
	MsgLeave      = "leave"
)

// Outbound message types (server → client).
const (
	MsgQueue      = "queue"
	MsgRoomLobby  = "room_lobby"  // private-room waiting state (code + who's joined)
	MsgRoomClosed = "room_closed" // private room disbanded before it started
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
	Opponents int    `json:"opponents"` // join_queue / create_room: opponents (total = opponents+1)
	Code      string `json:"code"`      // join_room: the private room code
	Suit      string `json:"suit"`      // play_card
	Rank      string `json:"rank"`      // play_card
}

// GameRecorder lets a room persist results without importing the service layer
// directly (keeps the dependency one-way). *service.GameService satisfies it.
type GameRecorder interface {
	RecordGame(uid int64, req model.RecordGameRequest) (model.Stats, error)
}
