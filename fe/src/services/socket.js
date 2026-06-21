import { WS_BASE } from '../config';
import { getToken } from './api';

// Single shared WebSocket for the session: connect once, dispatch typed
// messages to subscribers, auto-reconnect with backoff. The server rebinds a
// reconnecting socket to its in-progress room by user id, so reconnection needs
// no extra client handshake.
class GameSocket {
  constructor() {
    this.ws = null;
    this.handlers = {};        // type -> Set(cb)   ('*' receives every message)
    this.statusCbs = new Set();
    this.queue = [];           // messages buffered until the socket is open
    this.shouldReconnect = false;
    this.backoff = 500;
    this.status = 'idle';      // 'idle' | 'connecting' | 'open' | 'reconnecting'
    this._reconnectTimer = null;
  }

  connect() {
    const token = getToken();
    if (!token) return;
    this.shouldReconnect = true;
    this._open(token);
  }

  _open(token) {
    if (this.ws) return;
    this._setStatus(this.backoff > 500 ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 500;
      this._setStatus('open');
      const pending = this.queue;
      this.queue = [];
      pending.forEach(m => ws.send(m));
    };

    ws.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.handlers[msg.type]?.forEach(cb => cb(msg));
      this.handlers['*']?.forEach(cb => cb(msg));
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.shouldReconnect) { this._setStatus('idle'); return; }
      this._setStatus('reconnecting');
      const delay = this.backoff;
      this.backoff = Math.min(this.backoff * 2, 8000);
      this._reconnectTimer = setTimeout(() => {
        const t = getToken();
        if (this.shouldReconnect && t) this._open(t);
      }, delay);
    };

    ws.onerror = () => { try { ws.close(); } catch {} };
  }

  send(type, payload = {}) {
    const m = JSON.stringify({ type, ...payload });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(m);
    else this.queue.push(m);
  }

  on(type, cb) {
    (this.handlers[type] ??= new Set()).add(cb);
    return () => this.off(type, cb);
  }
  off(type, cb) { this.handlers[type]?.delete(cb); }

  onStatus(cb) {
    this.statusCbs.add(cb);
    cb(this.status);
    return () => this.statusCbs.delete(cb);
  }
  _setStatus(s) {
    this.status = s;
    this.statusCbs.forEach(cb => cb(s));
  }

  // Fully tear down — used when the user cancels matchmaking or leaves a game.
  disconnect() {
    this.shouldReconnect = false;
    this.queue = [];
    clearTimeout(this._reconnectTimer);
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this._setStatus('idle');
  }
}

export const socket = new GameSocket();
