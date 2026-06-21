package realtime

import (
	"fmt"
	"sync/atomic"

	"github.com/gorilla/websocket"
)

// HubConfig holds the tunables a room needs. Sourced from config.Config.
type HubConfig struct {
	WarnSecs   int // idle seconds on your turn before the "are you there?" prompt
	GraceSecs  int // seconds to respond to the prompt before a retry is lost / burn
	MaxRetries int // number of "I am here" retries before burn + push out
	MinPlayers int // smallest allowed room size (total players)
	MaxPlayers int // largest allowed room size (total players)
}

// Hub owns matchmaking and the set of active rooms. All mutable state is
// confined to a single goroutine (the cmds loop) — no locks needed.
type Hub struct {
	cmds   chan func()
	queues map[int][]*Client // total-players → waiting clients
	rooms  map[string]*Room
	byUID  map[int64]*Room // active room per user, for reconnect
	cfg    HubConfig
	rec    GameRecorder
	roomNo atomic.Int64
}

func NewHub(cfg HubConfig, rec GameRecorder) *Hub {
	if cfg.MinPlayers < 2 {
		cfg.MinPlayers = 2
	}
	if cfg.MaxPlayers < cfg.MinPlayers {
		cfg.MaxPlayers = cfg.MinPlayers
	}
	h := &Hub{
		cmds:   make(chan func(), 64),
		queues: map[int][]*Client{},
		rooms:  map[string]*Room{},
		byUID:  map[int64]*Room{},
		cfg:    cfg,
		rec:    rec,
	}
	go h.run()
	return h
}

func (h *Hub) run() {
	for fn := range h.cmds {
		fn()
	}
}

func (h *Hub) do(fn func()) { h.cmds <- fn }

// Handle takes ownership of a freshly authenticated connection: rebinds it to
// an in-progress room if the user is reconnecting, otherwise leaves it idle
// until it sends join_queue. Blocks (serving pumps) until the socket closes.
func (h *Hub) Handle(conn *websocket.Conn, uid int64, username string) {
	c := newClient(h, conn, uid, username)
	done := make(chan struct{})
	h.do(func() {
		if r, ok := h.byUID[uid]; ok {
			c.setRoom(r)
			r.reconnect(c)
		}
		close(done)
	})
	<-done
	c.Serve()
}

func (h *Hub) joinQueue(c *Client, opponents int) {
	h.do(func() {
		if c.currentRoom() != nil {
			return // already in a game
		}
		total := opponents + 1
		if total < h.cfg.MinPlayers || total > h.cfg.MaxPlayers {
			c.sendMsg(MsgError, map[string]any{"msg": fmt.Sprintf("player count must be %d–%d (got %d)", h.cfg.MinPlayers, h.cfg.MaxPlayers, total)})
			return
		}
		// Avoid duplicate queue entries for the same client.
		for _, q := range h.queues[total] {
			if q == c {
				return
			}
		}
		h.queues[total] = append(h.queues[total], c)
		h.broadcastQueue(total)

		if len(h.queues[total]) >= total {
			members := h.queues[total][:total]
			h.queues[total] = h.queues[total][total:]
			h.startRoom(members)
		}
	})
}

func (h *Hub) broadcastQueue(total int) {
	q := h.queues[total]
	for _, c := range q {
		c.sendMsg(MsgQueue, map[string]any{"joined": len(q), "needed": total})
	}
}

func (h *Hub) startRoom(members []*Client) {
	id := fmt.Sprintf("r%d", h.roomNo.Add(1))
	r := newRoom(id, h, members, h.cfg, h.rec)
	h.rooms[id] = r
	for _, c := range members {
		c.setRoom(r)
		h.byUID[c.uid] = r
	}
	r.start()
}

func (h *Hub) leave(c *Client) {
	h.do(func() {
		if h.removeFromQueue(c) {
			return
		}
		if r := c.currentRoom(); r != nil {
			r.leave(c)
		}
	})
}

func (h *Hub) disconnect(c *Client) {
	h.do(func() {
		if h.removeFromQueue(c) {
			return
		}
		if r := c.currentRoom(); r != nil {
			r.disconnect(c)
		}
	})
}

func (h *Hub) removeFromQueue(c *Client) bool {
	for total, q := range h.queues {
		for i, qc := range q {
			if qc == c {
				h.queues[total] = append(q[:i], q[i+1:]...)
				h.broadcastQueue(total)
				return true
			}
		}
	}
	return false
}

// closeRoom is called by a room when its game is over so the hub can release
// references (uid → room mappings).
func (h *Hub) closeRoom(r *Room) {
	h.do(func() {
		delete(h.rooms, r.id)
		for _, p := range r.players {
			if h.byUID[p.uid] == r {
				delete(h.byUID, p.uid)
			}
		}
	})
}
