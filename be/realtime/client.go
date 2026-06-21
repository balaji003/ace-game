package realtime

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// Client wraps one authenticated WebSocket connection.
type Client struct {
	uid      int64
	username string
	conn     *websocket.Conn
	send     chan []byte
	hub      *Hub

	mu   sync.Mutex
	room *Room // current room (nil while idle/queued)
}

func newClient(hub *Hub, conn *websocket.Conn, uid int64, username string) *Client {
	return &Client{
		uid:      uid,
		username: username,
		conn:     conn,
		send:     make(chan []byte, 16),
		hub:      hub,
	}
}

func (c *Client) setRoom(r *Room) {
	c.mu.Lock()
	c.room = r
	c.mu.Unlock()
}

func (c *Client) currentRoom() *Room {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.room
}

// sendMsg marshals and enqueues a message. Drops the connection if its buffer
// is full (slow/dead client) so one stuck socket can't block the room.
func (c *Client) sendMsg(typ string, fields map[string]any) {
	if fields == nil {
		fields = map[string]any{}
	}
	fields["type"] = typ
	b, err := json.Marshal(fields)
	if err != nil {
		return
	}
	select {
	case c.send <- b:
	default:
		// Buffer full — close to trigger cleanup via the write pump.
		_ = c.conn.Close()
	}
}

// readPump reads inbound messages and routes them to the hub/room. It runs
// until the connection errors, then notifies the hub of the disconnect.
func (c *Client) readPump() {
	defer func() {
		c.hub.disconnect(c)
		_ = c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var in Inbound
		if err := json.Unmarshal(data, &in); err != nil {
			c.sendMsg(MsgError, map[string]any{"msg": "bad message"})
			continue
		}
		switch in.Type {
		case MsgJoinQueue:
			c.hub.joinQueue(c, in.Opponents)
		case MsgPlayCard:
			if r := c.currentRoom(); r != nil {
				r.play(c, in.Suit, in.Rank)
			}
		case MsgImHere:
			if r := c.currentRoom(); r != nil {
				r.imHere(c)
			}
		case MsgLeave:
			c.hub.leave(c)
		default:
			c.sendMsg(MsgError, map[string]any{"msg": "unknown type: " + in.Type})
		}
	}
}

// writePump drains the send channel to the socket and sends periodic pings.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Serve starts the read/write pumps for a freshly connected client. It blocks
// until the read pump exits (connection closed).
func (c *Client) Serve() {
	go c.writePump()
	c.readPump()
}

func logf(format string, args ...any) { log.Printf("[realtime] "+format, args...) }
