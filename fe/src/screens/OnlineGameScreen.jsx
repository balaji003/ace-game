import { useMemo, useState, useEffect, useRef } from 'react';
import { SUITS, RANK_VAL } from '../constants';
import { highestOf } from '../utils/deck';
import { socket } from '../services/socket';
import * as haptics from '../native/haptics';
import { sounds } from '../native/sound';
import Arena from '../components/Arena';
import FannedHand from '../components/FannedHand';

// Online board. State is server-authoritative and arrives "you-centric" (the
// recipient is display seat 0). We rebuild the offline `game` shape so the
// shared presentational components render unchanged.
//
// Props:
//   start, state — room start + latest 'state'
//   event        — transient { kind:'player_left'|'game_over', ... }
//   prompt       — my no-response popup { triesLeft, last, secondsLeft } or null
//   peerIdle     — "waiting for X" banner { seat, secondsLeft } or null
//   socketStatus — connection status (reconnect banner)
//   maxRetries   — retries before burn (from /api/config)
//   onImHere     — tell the server I'm still here
//   onExit       — leave the game (marked as a loss) → lobby
export default function OnlineGameScreen({ start, state, event, prompt, peerIdle, socketStatus, maxRetries = 3, onImHere, onExit }) {
  const names = state?.names ?? start?.names ?? [];
  const isOver = event?.kind === 'game_over' || state?.phase === 'gameOver';
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [count, setCount] = useState(0);

  // Local countdown mirroring the server grace timer on the prompt popup.
  useEffect(() => { setCount(prompt ? (prompt.secondsLeft || 0) : 0); }, [prompt]);
  useEffect(() => {
    if (!prompt || count <= 0) return;
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [prompt, count]);

  const game = useMemo(() => {
    if (!state) return null;
    const n = state.n;
    const hands = Array.from({ length: n }, (_, d) =>
      d === 0 ? (state.hand || []) : Array.from({ length: state.handCounts?.[d] ?? 0 }, () => null)
    );
    return {
      n, hands,
      roundCards: state.roundCards || [],
      ledSuit: state.ledSuit || null,
      phase: state.phase,
      finished: state.finished || [],
      resultType: state.resultType || '',
      resultMsg: state.resultMsg || '',
      nextLeader: state.nextLeader,
      leader: state.leader,
    };
  }, [state]);

  const cur = state?.turn ?? -1;
  const isMyTurn = !!game && game.phase === 'playing' && cur === 0;

  const myHand = useMemo(() => {
    const h = state?.hand || [];
    return [...h].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANK_VAL[a.rank] - RANK_VAL[b.rank]);
  }, [state]);

  const validSet = useMemo(() => {
    const set = new Set();
    if (!isMyTurn || !game) return set;
    const h = state.hand || [];
    if (game.ledSuit) {
      const suited = h.filter(c => c.suit === game.ledSuit);
      (suited.length ? suited : h).forEach(c => set.add(c.suit + c.rank));
    } else {
      h.forEach(c => set.add(c.suit + c.rank));
    }
    return set;
  }, [isMyTurn, game, state]);

  const highestCard = game && game.roundCards.length && game.ledSuit
    ? highestOf(game.roundCards, game.ledSuit) : null;

  const reconnecting = socketStatus === 'reconnecting' || socketStatus === 'connecting';
  const youLost = event?.kind === 'game_over' ? event.youLost : (state?.loser === 0);
  const triesLeft = prompt?.triesLeft ?? maxRetries;

  // Haptic + sound cues on key transitions.
  const prevTurn = useRef(false), prevPhase = useRef(''), overFired = useRef(false);
  useEffect(() => {
    if (isMyTurn && !prevTurn.current) { haptics.tap(); sounds.turn(); }
    prevTurn.current = isMyTurn;
  }, [isMyTurn]);
  useEffect(() => {
    const ph = game?.phase || '';
    if (ph === 'result' && prevPhase.current !== 'result' && game.resultType === 'cut') { haptics.impact(); sounds.cut(); }
    prevPhase.current = ph;
  }, [game?.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOver && !overFired.current) { overFired.current = true; haptics.notify(!youLost); (youLost ? sounds.lose : sounds.win)(); }
    if (!isOver) overFired.current = false;
  }, [isOver, youLost]);
  useEffect(() => { if (prompt) haptics.notify(false); }, [!!prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 40%,#0c4a6e,#04293d)',
      fontFamily: 'Georgia,serif', color: '#fff', padding: 10,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Game-over overlay */}
      {isOver && (
        <Overlay>
          <div style={{ fontSize: 38, marginBottom: 8 }}>{youLost ? '💀' : '🏆'}</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: youLost ? '#fca5a5' : '#4ade80' }}>
            {youLost ? 'You Lost!' : 'You Won!'}
          </div>
          <div style={{ color: '#a8a29e', fontSize: 13, marginBottom: 18 }}>
            {event?.kind === 'game_over' && event.reason === 'timeout'
              ? 'A player was removed for not responding.' : 'Game over.'}
          </div>
          <Btn color={youLost ? 'red' : 'green'} onClick={onExit}>Back to Lobby</Btn>
        </Overlay>
      )}

      {/* No-response popup (my turn, idle) */}
      {prompt && !isOver && (
        <Overlay borderColor={prompt.last ? '#ef4444' : '#0ea5e9'}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⏰</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: prompt.last ? '#fca5a5' : '#7dd3fc', marginBottom: 6 }}>
            Are you still there?
          </div>
          <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 6 }}>
            {prompt.last
              ? '⚠ Last attempt — play now or you’ll be removed.'
              : `It’s your turn. You have ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
            Removing you in <strong style={{ color: '#ef4444' }}>{count}s</strong>…
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Btn color="green" onClick={onImHere}>I am here</Btn>
            <Btn color="red" outline onClick={() => setConfirmLeave(true)}>Leave</Btn>
          </div>
        </Overlay>
      )}

      {/* Leave confirmation */}
      {confirmLeave && !isOver && (
        <Overlay borderColor="#ef4444">
          <div style={{ fontSize: 28, marginBottom: 8 }}>🚪</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: '#f9fafb' }}>Leave game?</div>
          <div style={{ fontSize: 13, color: '#a8a29e', marginBottom: 20 }}>
            Leaving now will be recorded as a <strong style={{ color: '#fca5a5' }}>loss</strong>.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Btn color="blue" onClick={() => setConfirmLeave(false)}>Keep playing</Btn>
            <Btn color="red" onClick={onExit}>Leave &amp; lose</Btn>
          </div>
        </Overlay>
      )}

      {/* Top bar: Leave (left) · ACE + Online (centre) · spacer (right) */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 720, margin: '0 auto 8px' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <Btn color="red" outline small onClick={() => setConfirmLeave(true)}>← Leave</Btn>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 3, color: '#7dd3fc' }}>♠ ACE</div>
          <div style={{
            display: 'inline-block', marginTop: 2, fontSize: 10, padding: '2px 8px', borderRadius: 6,
            background: '#0c4a6e', color: '#7dd3fc', border: '1px solid #0ea5e9',
          }}>🌐 Online</div>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Reconnecting banner */}
      {reconnecting && (
        <Banner color="amber">⚠ Connection lost — reconnecting…</Banner>
      )}

      {/* Peer not responding */}
      {peerIdle && !isOver && (
        <Banner color="slate">⏳ Waiting for {names[peerIdle.seat] ?? 'a player'} to respond…</Banner>
      )}

      {/* Player removed */}
      {event?.kind === 'player_left' && !isOver && (
        <Banner color="red">🚪 {names[event.seat] ?? 'A player'} was removed ({event.reason}).</Banner>
      )}

      {!game ? (
        <div style={{ maxWidth: 720, margin: '40px auto', textAlign: 'center', color: '#7dd3fc', fontSize: 14 }}>
          Setting up the table…
        </div>
      ) : (
        <div style={{ flex: 1, width: '100%', maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <Arena game={game} cur={cur} aiStatus="" highestCard={highestCard} names={names} theme="blue" />

          {/* My status bar */}
          <div style={{
            background: isMyTurn ? '#fef9c311' : '#0c4a6e55',
            border: `1.5px solid ${isMyTurn ? '#fde68a' : '#0e7490'}`,
            borderRadius: 8, padding: '5px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#7dd3fc', fontWeight: 700, fontSize: 13 }}>You</span>
            <span style={{ color: '#bae6fd', fontSize: 12 }}>
              {myHand.length} cards
              {isMyTurn && !game.ledSuit && ' · Lead any card'}
              {isMyTurn && game.ledSuit && (state.hand || []).some(c => c.suit === game.ledSuit) && ` · Follow ${game.ledSuit}`}
              {isMyTurn && game.ledSuit && !(state.hand || []).some(c => c.suit === game.ledSuit) && ` · Must cut! (no ${game.ledSuit})`}
            </span>
            {game.finished.includes(0) && (
              <span style={{ fontSize: 12, color: '#4ade80' }}>✅ #{game.finished.indexOf(0) + 1}</span>
            )}
          </div>

          <FannedHand
            cards={myHand}
            validSet={validSet}
            isMyTurn={isMyTurn}
            onPlay={card => { sounds.play(); socket.send('play_card', { suit: card.suit, rank: card.rank }); }}
          />
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.75} }
        @keyframes flashBg { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
        @keyframes popEmblem { 0%{transform:scale(0) rotate(-12deg);opacity:0} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes flyDead { 0%{transform:translate(0,0) rotate(0) scale(1);opacity:1} 40%{opacity:1} 100%{transform:translate(var(--dx),-130px) rotate(var(--rot)) scale(0.4);opacity:0} }
        @keyframes flySwept { 0%{transform:translate(0,0) scale(1);opacity:1} 35%{transform:translate(var(--cx),0) scale(0.8);opacity:1} 100%{transform:translate(calc(var(--cx) + var(--tx)),var(--ty)) scale(0.1);opacity:0} }
        @keyframes ember { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--ex),var(--ey)) scale(0);opacity:0} }
      `}</style>
    </div>
  );
}

// --- small shared UI helpers ---

function Overlay({ children, borderColor = '#0ea5e9' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000000c0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'linear-gradient(135deg,#111827,#1e293b)', border: `2px solid ${borderColor}`, borderRadius: 14, padding: '26px 30px', textAlign: 'center', maxWidth: 340 }}>
        {children}
      </div>
    </div>
  );
}

function Banner({ children, color }) {
  const c = {
    amber: { bg: '#3f2d1a', bd: '#a16207', fg: '#fcd34d' },
    slate: { bg: '#1e293b', bd: '#64748b', fg: '#cbd5e1' },
    red: { bg: '#3f1a1a', bd: '#ef444466', fg: '#fca5a5' },
  }[color];
  return (
    <div style={{ maxWidth: 720, margin: '0 auto 8px', width: '100%', background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: c.fg, textAlign: 'center' }}>
      {children}
    </div>
  );
}

const BTN_COLORS = {
  green: { bg: '#16a34a', bd: '#16a34a', fg: '#fff' },
  red: { bg: '#dc2626', bd: '#dc2626', fg: '#fff' },
  blue: { bg: '#0ea5e9', bd: '#0ea5e9', fg: '#fff' },
};

function Btn({ children, color = 'blue', outline = false, small = false, onClick }) {
  const c = BTN_COLORS[color];
  return (
    <button onClick={onClick} style={{
      background: outline ? 'transparent' : c.bg,
      border: `1.5px solid ${c.bd}`,
      color: outline ? c.fg === '#fff' ? c.bd : c.fg : '#fff',
      borderRadius: 8,
      padding: small ? '5px 12px' : '10px 22px',
      cursor: 'pointer', fontSize: small ? 12 : 14, fontWeight: 700, fontFamily: 'Georgia,serif',
    }}>{children}</button>
  );
}
