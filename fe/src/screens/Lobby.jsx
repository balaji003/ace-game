import { useState, useEffect } from 'react';
import { AI_ENABLED } from '../config';
import TablePreview from '../components/TablePreview';

// Props:
//   username       — logged-in username
//   onStart        — called with (numOpponents, useAI)
//   onPlayOnline   — called with (numOpponents) to enter online matchmaking
//   onOpenSettings — opens the settings panel
//   minPlayers     — smallest allowed total players (from /api/config; default 3)
//   maxPlayers     — largest allowed total players (from /api/config; default 7)
export default function Lobby({ username, onStart, onPlayOnline, onOpenSettings, minPlayers = 3, maxPlayers = 7 }) {
  // Player counts are TOTAL players (including the person selecting), so the
  // smallest option is the minimum room size — never a confusing "1".
  const lo = Math.max(2, minPlayers);
  const hi = Math.max(lo, maxPlayers);
  const totalRange = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  const [players, setPlayers] = useState(() => Math.min(Math.max(4, lo), hi));   // offline total
  const [useAI, setUseAI] = useState(AI_ENABLED);
  const [showOnline, setShowOnline] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState(lo);                        // online total
  const total = players;

  // Keep selections inside the allowed range if config arrives/changes after mount.
  useEffect(() => {
    setPlayers(p => Math.min(Math.max(p, lo), hi));
    setOnlinePlayers(p => Math.min(Math.max(p, lo), hi));
  }, [lo, hi]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%,#1a7a4f,#0a2e1c 75%)',
      fontFamily: 'Georgia,serif', color: '#fff', padding: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 440, margin: '0 auto 20px' }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: '#4ade80' }}>♠ ACE</span>
          <span style={{ fontSize: 11, color: '#4ade8088', marginLeft: 8 }}>@{username}</span>
        </div>
        <button onClick={onOpenSettings} title="Settings" style={{
          background: '#0f3d28', border: '1px solid #4ade8066', color: '#4ade80',
          borderRadius: 8, width: 34, height: 32, cursor: 'pointer', fontSize: 16,
        }}>⚙</button>
      </div>

      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 13, color: '#86efac', letterSpacing: 1 }}>NEW GAME · vs AI</div>
        <div style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, color: '#f0fdf4', marginBottom: 6 }}>
          How many players?
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#86efac99', marginBottom: 20 }}>
          including you (you + {players - 1} {players - 1 === 1 ? 'opponent' : 'opponents'})
        </div>

        {/* Total player count grid (includes you) */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(totalRange.length, 6)},1fr)`, gap: 8, marginBottom: 24 }}>
          {totalRange.map(n => (
            <button key={n} onClick={() => setPlayers(n)} style={{
              aspectRatio: '1', borderRadius: 12, cursor: 'pointer',
              border: players === n ? '2.5px solid #fbbf24' : '1.5px solid #16653488',
              background: players === n ? 'linear-gradient(160deg,#16a34a,#15803d)' : '#0f3d28',
              color: players === n ? '#fff' : '#86efac',
              fontSize: 24, fontWeight: 700, fontFamily: 'Georgia,serif',
              boxShadow: players === n ? '0 6px 18px #16a34a55' : 'none',
              transition: 'all 0.15s',
              transform: players === n ? 'scale(1.05)' : 'scale(1)',
            }}>{n}</button>
          ))}
        </div>

        <TablePreview total={total} />

        <div style={{ textAlign: 'center', color: '#86efac', fontSize: 13, margin: '18px 0' }}>
          {total} players · 52 cards dealt{' '}
          <span style={{ color: '#fde68a' }}>~{Math.floor(52 / total)}–{Math.ceil(52 / total)} each</span>
        </div>

        {/* AI mode toggle — only shown when AI is enabled by config */}
        {AI_ENABLED && (
          <>
            <div style={{ fontSize: 12, color: '#86efac', letterSpacing: 1, marginBottom: 8, textAlign: 'center' }}>OPPONENT TYPE</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {[
                { v: true,  label: '🧠 Smart AI',    desc: 'Claude reasons each move (needs backend)' },
                { v: false, label: '⚡ Quick Bots',  desc: 'Instant local logic, always works' },
              ].map(opt => (
                <button key={String(opt.v)} onClick={() => setUseAI(opt.v)} style={{
                  flex: 1, textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '12px 14px',
                  border: useAI === opt.v ? '2.5px solid #fbbf24' : '1.5px solid #16653488',
                  background: useAI === opt.v ? 'linear-gradient(160deg,#16a34a,#15803d)' : '#0f3d28',
                  color: '#fff', fontFamily: 'Georgia,serif', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{opt.label}</div>
                  <div style={{ fontSize: 10.5, color: useAI === opt.v ? '#dcfce7' : '#86efac99', lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Online multiplayer CTA — between bot options and Deal & Start */}
        <button onClick={() => setShowOnline(true)} style={{
          width: '100%', padding: 13, borderRadius: 12, marginBottom: 12,
          border: '1.5px solid #38bdf8', background: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
          color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Georgia,serif', letterSpacing: 1,
          cursor: 'pointer', boxShadow: '0 5px 16px #0ea5e944',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          🌐 Play Online
        </button>

        <button onClick={() => onStart(players - 1, AI_ENABLED && useAI)} style={{
          width: '100%', padding: 15, borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff',
          fontSize: 17, fontWeight: 700, fontFamily: 'Georgia,serif', letterSpacing: 1,
          cursor: 'pointer', boxShadow: '0 6px 20px #16a34a44',
        }}>
          Deal & Start ♠
        </button>
      </div>

      {/* Online opponent picker overlay */}
      {showOnline && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, background: '#000000aa',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#0c2d44', border: '1.5px solid #38bdf8', borderRadius: 16,
            padding: '26px 26px', maxWidth: 360, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 34, marginBottom: 6 }}>🌐</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e0f2fe', marginBottom: 4 }}>Play Online</div>
            <div style={{ fontSize: 12.5, color: '#7dd3fc', marginBottom: 20 }}>
              Match with real players. How many players? (including you)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(totalRange.length, 6)},1fr)`, gap: 8, marginBottom: 20 }}>
              {totalRange.map(n => {
                const selected = onlinePlayers === n;
                return (
                  <button key={n} onClick={() => setOnlinePlayers(n)} style={{
                    aspectRatio: '1', borderRadius: 12, cursor: 'pointer',
                    border: selected ? '2.5px solid #fbbf24' : '1.5px solid #1e6a8e',
                    background: selected ? 'linear-gradient(160deg,#0ea5e9,#0369a1)' : '#0a2233',
                    color: '#e0f2fe',
                    fontSize: 22, fontWeight: 700, fontFamily: 'Georgia,serif',
                  }}>{n}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: '#7dd3fc', marginBottom: 4 }}>
              <strong>{onlinePlayers} players</strong> — you + {onlinePlayers - 1} {onlinePlayers - 1 === 1 ? 'other' : 'others'}
            </div>
            <div style={{ fontSize: 11, color: '#7dd3fc99', marginBottom: 20 }}>
              everyone must pick the same size to match
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowOnline(false)} style={{
                background: 'transparent', border: '1.5px solid #38bdf866', color: '#7dd3fc',
                borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontFamily: 'Georgia,serif',
              }}>Cancel</button>
              <button onClick={() => { setShowOnline(false); onPlayOnline?.(onlinePlayers - 1); }} style={{
                background: 'linear-gradient(135deg,#0ea5e9,#0369a1)', border: 'none', color: '#fff',
                borderRadius: 8, padding: '10px 26px', cursor: 'pointer', fontSize: 14, fontFamily: 'Georgia,serif', fontWeight: 700,
              }}>Find Match →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
