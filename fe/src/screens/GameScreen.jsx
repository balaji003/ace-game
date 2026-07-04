import { useState, useEffect, useRef } from 'react';
import { NAMES, SUITS, RANK_VAL, IS_RED } from '../constants';
import { initGame, resolveRound, applyPlay } from '../game/engine';
import { pickMove, explainMove } from '../game/ai';
import * as haptics from '../native/haptics';
import { sounds } from '../native/sound';
import { highestOf } from '../utils/deck';
import { AI_PLAY_MS, RESULT_PAUSE_MS } from '../config';
import { BOARD_BG_GREEN } from '../theme';
import Arena from '../components/Arena';
import FannedHand from '../components/FannedHand';
import DealAnimation from '../components/DealAnimation';
import Logo from '../components/Logo';

// Props:
//   username       — logged-in username (display only)
//   nPlayers       — total players including human
//   useAI          — kept for compatibility; opponents are always strategic local bots
//   onExit         — go back to Lobby
//   onOpenSettings — opens the settings panel
//   onGameEnd      — called with { won, placement, opponents } when game finishes
export default function GameScreen({ username, nPlayers, useAI, practice = false, onExit, onOpenSettings, onGameEnd, watchCountdownSecs = 10, afkWarnSecs = 20, afkGraceSecs = 10, maxRetries = 3 }) {
  const [game, setGame] = useState(() => initGame(nPlayers));
  const [dealing, setDealing] = useState(true);   // start-of-game deal animation
  const [aiStatus, setAiStatus] = useState('');
  const [confirmLeave, setConfirmLeave]   = useState(false);
  const [confirmRedeal, setConfirmRedeal] = useState(false);
  const [watchPrompt, setWatchPrompt]     = useState(false);
  const [watching, setWatching]           = useState(false);
  const [watchCountdown, setWatchCountdown] = useState(0);
  const [afkPhase, setAfkPhase] = useState(null); // null | 'board' | 'popup'
  const [afkCountdown, setAfkCountdown] = useState(0);
  const [afkRetries, setAfkRetries] = useState(0); // "I'm Here" clicks used
  const watchShownRef = useRef(false);
  const afkTimerRef  = useRef(null);

  const logRef = useRef(null);
  const aiInFlight = useRef(false);
  const reportedRef = useRef(false);

  const clearAfkTimer = () => clearTimeout(afkTimerRef.current);
  const resetAfk = () => { clearAfkTimer(); setAfkPhase(null); setAfkCountdown(0); setAfkRetries(0); };
  const armAfk = () => {
    clearAfkTimer();
    setAfkPhase(null);
    setAfkCountdown(0);
    afkTimerRef.current = setTimeout(() => {
      setAfkPhase('board');
      setAfkCountdown(afkGraceSecs);
    }, afkWarnSecs * 1000);
  };

  // "I'm Here": consume a retry; past the cap → burn out to the lobby.
  const handleImHere = () => {
    if (afkRetries + 1 > maxRetries) { onExit(); return; }
    setAfkRetries(r => r + 1);
    armAfk();
  };
  const afkTriesLeft = maxRetries - afkRetries;

  // Haptic + sound cues on key transitions.
  const myTurnNow = game.phase === 'playing' && game.roundOrder[game.turnIdx] === 0;
  const prevTurn = useRef(false), prevPhase = useRef(''), overFired = useRef(false);
  useEffect(() => {
    if (myTurnNow && !prevTurn.current) { haptics.tap(); sounds.turn(); }
    prevTurn.current = myTurnNow;
  }, [myTurnNow]);
  useEffect(() => {
    if (game.phase === 'result' && prevPhase.current !== 'result') {
      if (game.resultType === 'cut') { haptics.impact(); sounds.cut(); }
      else if (game.resultType === 'dead') { haptics.tap(); sounds.dead(); }
    }
    prevPhase.current = game.phase;
  }, [game.phase, game.resultType]);
  useEffect(() => {
    if (game.phase === 'gameOver' && !overFired.current) {
      overFired.current = true;
      const lost = game.loser === 0;
      haptics.notify(!lost); (lost ? sounds.lose : sounds.win)();
    }
    if (game.phase !== 'gameOver') overFired.current = false;
  }, [game.phase, game.loser]);
  useEffect(() => { if (afkPhase === 'popup') haptics.notify(false); }, [afkPhase]);

  useEffect(() => {
    if (game.phase === 'gameOver' && !reportedRef.current) {
      reportedRef.current = true;
      const won = game.loser !== 0;
      const placement = game.finished.indexOf(0);
      onGameEnd?.({
        won,
        placement: placement >= 0 ? placement + 1 : game.n,
        opponents: NAMES.slice(1, game.n),
      });
    }
    if (game.phase !== 'gameOver') {
      reportedRef.current = false;
    }
  }, [game.phase]);

  // Show watch prompt the moment player 0 plays their last card (enters finished list)
  useEffect(() => {
    if (game.finished.includes(0) && !watchShownRef.current && game.phase !== 'gameOver' && nPlayers - game.finished.length > 1) {
      watchShownRef.current = true;
      setWatchCountdown(watchCountdownSecs);
      setWatchPrompt(true);
    }
    if (!game.finished.includes(0)) {
      watchShownRef.current = false;
      setWatchPrompt(false);
      setWatching(false);
    }
  }, [game.finished]);

  // Watch countdown tick → auto-exit at 0
  useEffect(() => {
    if (!watchPrompt || watchCountdown <= 0) return;
    const t = setTimeout(() => setWatchCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [watchPrompt, watchCountdown]);

  useEffect(() => {
    if (watchPrompt && watchCountdown === 0) onExit();
  }, [watchCountdown, watchPrompt]);

  // AFK: arm/disarm based on whose turn it is
  useEffect(() => {
    const myTurn = game.phase === 'playing' && game.roundOrder[game.turnIdx] === 0;
    if (myTurn) {
      armAfk();
    } else {
      resetAfk();
    }
    return clearAfkTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.turnIdx]);

  // AFK countdown tick (board + popup phases)
  useEffect(() => {
    if ((afkPhase !== 'board' && afkPhase !== 'popup') || afkCountdown <= 0) return;
    const t = setTimeout(() => setAfkCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [afkPhase, afkCountdown]);

  // AFK phase transitions at countdown 0
  useEffect(() => {
    if (afkPhase === 'board' && afkCountdown === 0) {
      setAfkPhase('popup');
      setAfkCountdown(afkGraceSecs);
    } else if (afkPhase === 'popup' && afkCountdown === 0) {
      onExit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afkPhase, afkCountdown]);

  // Auto-scroll the log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [game.log]);

  // Hold the result on screen (RESULT_PAUSE_MS) then advance to the next round.
  useEffect(() => {
    if (game.phase !== 'result') return;
    const timer = setTimeout(() => {
      setGame(g => {
        if (g.phase !== 'result') return g;
        const next = resolveRound(g);
        if (next.phase === 'playing') {
          const cur = next.roundOrder[next.turnIdx];
          return { ...next, pendingAI: cur !== 0 };
        }
        return next;
      });
    }, RESULT_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [game.phase, game.resultMsg]);

  // Trigger AI move whenever pendingAI is set
  useEffect(() => {
    if (dealing || !game.pendingAI || game.phase !== 'playing') return;
    const cur = game.roundOrder[game.turnIdx];
    if (cur === 0 || aiInFlight.current) return;

    aiInFlight.current = true;
    const snapshot = JSON.parse(JSON.stringify(game));

    // Strategic bot (memory + cut/lead tactics), runs fully locally. The
    // "thinking…" pause is purely cosmetic so moves don't snap instantly.
    const card = pickMove(snapshot, cur);
    setAiStatus(`${NAMES[cur]} is thinking…`);
    setTimeout(() => {
      aiInFlight.current = false;
      setAiStatus('');
      setGame(g => {
        if (g.phase !== 'playing' || g.roundOrder[g.turnIdx] !== cur) return g;
        return { ...applyPlay(g, cur, card), pendingAI: false };
      });
    }, AI_PLAY_MS + Math.random() * 300);
  }, [game.pendingAI, game.turnIdx, dealing]);

  // Re-arm pendingAI after a round clears (e.g. if first player to go is AI).
  // Also fires when the deal animation ends so a bot starter takes its turn.
  useEffect(() => {
    if (dealing) return;
    if (game.phase === 'playing' && !game.pendingAI) {
      const cur = game.roundOrder[game.turnIdx];
      if (cur !== 0 && !aiInFlight.current) {
        setGame(g => ({ ...g, pendingAI: true }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.turnIdx, dealing]);

  const isMyTurn = game.phase === 'playing' && game.roundOrder[game.turnIdx] === 0;

  // Sort my hand by suit then rank for readability
  const myHand = [...game.hands[0]].sort(
    (a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANK_VAL[a.rank] - RANK_VAL[b.rank]
  );

  // Build the set of card keys I'm allowed to play
  const validSet = new Set();
  if (isMyTurn) {
    const h = game.hands[0];
    if (game.ledSuit) {
      const suited = h.filter(c => c.suit === game.ledSuit);
      (suited.length ? suited : h).forEach(c => validSet.add(c.suit + c.rank));
    } else {
      h.forEach(c => validSet.add(c.suit + c.rank));
    }
  }

  const cur = game.phase === 'playing' ? game.roundOrder[game.turnIdx] : -1;
  const highestCard = game.roundCards.length && game.ledSuit ? highestOf(game.roundCards, game.ledSuit) : null;

  // Practice coach: when it's the human's turn, run the bot's own logic from
  // seat 0 to recommend a card and explain why. Read-only; never mutates state.
  const coach = (practice && isMyTurn && !dealing) ? explainMove(game, 0) : null;
  const suggestKey = coach ? coach.card.suit + coach.card.rank : null;

  const startNewGame = () => {
    aiInFlight.current = false;
    setAiStatus('');
    reportedRef.current = false;
    watchShownRef.current = false;
    setConfirmRedeal(false);
    setWatchPrompt(false);
    setWatching(false);
    setWatchCountdown(0);
    resetAfk();
    setGame(initGame(nPlayers));
    setDealing(true);
  };

  const handleRedealClick = () => {
    if (game.phase === 'playing' || game.phase === 'result') {
      setConfirmRedeal(true);
    } else {
      startNewGame();
    }
  };

  const handleLobbyClick = () => {
    if (game.hands[0].length > 0) {
      setConfirmLeave(true);
    } else {
      onExit();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: BOARD_BG_GREEN,
      fontFamily: 'Verdana, sans-serif', color: '#14532d', padding: 10,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Start-of-game deal animation */}
      {dealing && <DealAnimation n={game.n} theme="green" onDone={() => setDealing(false)} />}

      {/* Watch game prompt — shown when human wins */}
      {watchPrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: '#00000099',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1c1917', border: '1.5px solid #4ade80', borderRadius: 14,
            padding: '28px 32px', textAlign: 'center', maxWidth: 320,
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏆</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>
              You're out! #{game.finished.indexOf(0) + 1}
            </div>
            <div style={{ fontSize: 13, color: '#a8a29e', marginBottom: 6 }}>
              Want to watch the others finish?
            </div>
            <div style={{ fontSize: 12, color: '#86efac66', marginBottom: 20 }}>
              Going to lobby in <strong style={{ color: '#fcd34d' }}>{watchCountdown}s</strong>…
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => { setWatchPrompt(false); setWatching(true); }}
                style={{
                  background: '#16a34a', border: 'none', color: '#fff',
                  borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
                }}
              >Watch Game</button>
              <button
                onClick={onExit}
                style={{
                  background: '#334155', border: 'none', color: '#fff', fontWeight: 700,
                  borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif',
                }}
              >Lobby</button>
            </div>
          </div>
        </div>
      )}

      {/* Redeal confirmation overlay */}
      {confirmRedeal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: '#00000099',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1c1917', border: '1.5px solid #4ade8066', borderRadius: 14,
            padding: '28px 32px', textAlign: 'center', maxWidth: 320,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔄</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: '#f9fafb' }}>Redeal?</div>
            <div style={{ fontSize: 13, color: '#a8a29e', marginBottom: 20 }}>
              Your game is still in progress. Starting over will discard the current hand.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmRedeal(false)}
                style={{
                  background: '#334155', border: 'none', color: '#fff', fontWeight: 700,
                  borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontFamily: 'Verdana, sans-serif',
                }}
              >Keep playing</button>
              <button
                onClick={startNewGame}
                style={{
                  background: '#dc2626', border: 'none', color: '#fff',
                  borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
                }}
              >Redeal</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave-game confirmation overlay */}
      {confirmLeave && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: '#00000099',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1c1917', border: '1.5px solid #4ade8066', borderRadius: 14,
            padding: '28px 32px', textAlign: 'center', maxWidth: 320,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🃏</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: '#f9fafb' }}>Leave game?</div>
            <div style={{ fontSize: 13, color: '#a8a29e', marginBottom: 20 }}>
              Your game is still in progress. Are you sure you want to go back to the lobby?
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmLeave(false)}
                style={{
                  background: '#334155', border: 'none', color: '#fff', fontWeight: 700,
                  borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontFamily: 'Verdana, sans-serif',
                }}
              >Keep playing</button>
              <button
                onClick={onExit}
                style={{
                  background: '#dc2626', border: 'none', color: '#fff',
                  borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
                }}
              >Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* AFK popup — shown after board countdown expires */}
      {afkPhase === 'popup' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: '#000000bb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1c1917', border: `1.5px solid ${afkTriesLeft <= 1 ? '#ef4444' : '#f59e0b'}`, borderRadius: 14,
            padding: '28px 32px', textAlign: 'center', maxWidth: 320,
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⏰</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: afkTriesLeft <= 1 ? '#fca5a5' : '#fcd34d', marginBottom: 6 }}>
              Are you still there?
            </div>
            <div style={{ fontSize: 13, color: '#a8a29e', marginBottom: 6 }}>
              {afkTriesLeft <= 1
                ? '⚠ Last attempt — act now or you’re out.'
                : `You've been idle too long. ${afkTriesLeft} tries left.`}
            </div>
            <div style={{ fontSize: 12, color: '#86efac66', marginBottom: 20 }}>
              Cards burning in <strong style={{ color: '#ef4444' }}>{afkCountdown}s</strong>…
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={handleImHere}
                style={{
                  background: '#16a34a', border: 'none', color: '#fff',
                  borderRadius: 8, padding: '10px 22px', cursor: 'pointer',
                  fontSize: 14, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
                }}
              >I'm Here!</button>
              <button
                onClick={onExit}
                style={{
                  background: '#dc2626', border: 'none', color: '#fff',
                  borderRadius: 8, padding: '10px 22px', cursor: 'pointer',
                  fontSize: 14, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
                }}
              >Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar: Lobby (left) · ACE + mode (centre) · Redeal (right) */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 720, margin: '0 auto 8px' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={handleLobbyClick} style={{ background: '#334155', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Verdana, sans-serif' }}>← Lobby</button>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Logo size={34} fontSize={20} textColor="#111" /></div>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleRedealClick} style={{ background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Verdana, sans-serif' }}>Redeal</button>
        </div>
      </div>


      <div style={{ flex: 1, width: '100%', maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>

        {/* Game-over banner */}
        {game.phase === 'gameOver' && (
          <div style={{
            background: 'linear-gradient(135deg,#1c1917,#292524)',
            border: `2px solid ${game.loser === 0 ? '#ef4444' : '#4ade80'}`,
            borderRadius: 12, padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>{game.loser === 0 ? '💀' : '🏆'}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: game.loser === 0 ? '#fca5a5' : '#4ade80' }}>
              {game.loser === 0 ? 'You Lost!' : 'You Won!'}
            </div>
            <div style={{ color: '#a8a29e', fontSize: 13, marginBottom: 14 }}>
              {game.loser != null ? `${NAMES[game.loser]} is the last one holding cards!` : ''}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={startNewGame} style={{
                background: game.loser === 0 ? '#dc2626' : '#16a34a', border: 'none', color: '#fff',
                borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
              }}>Redeal ({game.n})</button>
              <button onClick={onExit} style={{
                background: 'transparent', border: '1.5px solid #4ade8066', color: '#4ade80',
                borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
              }}>Lobby</button>
            </div>
          </div>
        )}

        <Arena game={game} cur={cur} aiStatus={aiStatus} highestCard={highestCard} />

        {/* My status bar */}
        <div style={{
          background: isMyTurn ? '#fef9c3cc' : '#ffffffbb',
          border: `1.5px solid ${isMyTurn ? '#eab308' : '#16a34a55'}`,
          borderRadius: 8, padding: '5px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#111', fontWeight: 700, fontSize: 13 }}>You</span>
          <span style={{ color: '#222', fontSize: 12 }}>
            {myHand.length} cards
            {isMyTurn && !game.ledSuit && ' · Lead any card'}
            {isMyTurn && game.ledSuit && game.hands[0].some(c => c.suit === game.ledSuit) && ` · Follow ${game.ledSuit}`}
            {isMyTurn && game.ledSuit && !game.hands[0].some(c => c.suit === game.ledSuit) && ` · Must cut! (no ${game.ledSuit})`}
          </span>
          {game.finished.includes(0) && (
            <span style={{ fontSize: 12, color: '#111' }}>✅ #{game.finished.indexOf(0) + 1}</span>
          )}
        </div>

        {/* AFK countdown bar — shown during board phase */}
        {afkPhase === 'board' && (
          <div style={{
            background: '#3f1a1a44', border: '1px solid #ef444466', borderRadius: 6,
            padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 11, color: '#fca5a5', flexShrink: 0 }}>
              ⏱ Act in {afkCountdown}s
            </span>
            <div style={{ flex: 1, height: 4, background: '#1c1917', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: afkCountdown > afkGraceSecs * 0.4 ? '#fde68a' : '#ef4444',
                width: `${(afkCountdown / afkGraceSecs) * 100}%`,
                transition: 'width 1s linear, background 0.5s',
              }} />
            </div>
          </div>
        )}

        {/* Practice coach — suggests a card (same logic the bots use) + reason */}
        {coach && (
          <div style={{
            background: 'linear-gradient(135deg,#0c2d44,#0a2233)',
            border: '1.5px solid #38bdf8', borderRadius: 8, padding: '7px 11px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🎓</span>
            <div style={{ flex: 1, lineHeight: 1.35 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e0f2fe' }}>
                Coach suggests{' '}
                <span style={{ color: IS_RED(coach.card.suit) ? '#fca5a5' : '#fff' }}>
                  {coach.card.rank}{coach.card.suit}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#7dd3fc', marginTop: 2 }}>{coach.reason}</div>
            </div>
          </div>
        )}

        <FannedHand
          cards={myHand}
          validSet={validSet}
          isMyTurn={isMyTurn}
          suggestKey={suggestKey}
          onPlay={card => { sounds.play(); resetAfk(); setGame(g => g.phase === 'playing' ? applyPlay(g, 0, card) : g); }}
        />

        {/* Play log */}
        <div
          ref={logRef}
          style={{
            background: '#0f172a99', border: '1px solid #1e293b', borderRadius: 8,
            padding: '6px 10px', maxHeight: 90, overflowY: 'auto',
            fontSize: 11, lineHeight: 1.7,
            scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent',
          }}
        >
          {game.log.slice(-20).map((line, i, arr) => (
            <div key={i} style={{ color: i === arr.length - 1 ? '#fde68a' : i === arr.length - 2 ? '#94a3b8' : '#475569' }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.75} }
        @keyframes flashBg { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
        @keyframes popEmblem { 0%{transform:scale(0) rotate(-12deg);opacity:0} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes flyDead {
          0%{transform:translate(0,0) rotate(0) scale(1);opacity:1}
          40%{opacity:1}
          100%{transform:translate(var(--dx),-130px) rotate(var(--rot)) scale(0.4);opacity:0}
        }
        @keyframes flySwept {
          0%  {transform:translate(0,0) scale(1);opacity:1}
          35% {transform:translate(var(--cx),0) scale(0.8);opacity:1}
          100%{transform:translate(calc(var(--cx) + var(--tx)),var(--ty)) scale(0.1);opacity:0}
        }
        @keyframes ember {
          0%{transform:translate(0,0) scale(1);opacity:1}
          100%{transform:translate(var(--ex),var(--ey)) scale(0);opacity:0}
        }
      `}</style>
    </div>
  );
}
