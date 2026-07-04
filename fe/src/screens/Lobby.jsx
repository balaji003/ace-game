import { useState, useEffect } from 'react';
import { AI_ENABLED } from '../config';
import TablePreview from '../components/TablePreview';
import Logo from '../components/Logo';

// Shared styles for the online-mode menu buttons.
const menuBtnStyle = {
  width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '13px 16px',
  marginBottom: 10, border: '1.5px solid #1e6a8e', background: '#0a2233',
  color: '#fff', fontFamily: 'Verdana, sans-serif',
};
const menuBtnTitle = { fontSize: 15, fontWeight: 700, marginBottom: 3, color: '#e0f2fe' };
const menuBtnDesc  = { fontSize: 11, color: '#7dd3fc99', lineHeight: 1.4 };

// Props:
//   username       — logged-in username
//   onStart        — called with (numOpponents, useAI)
//   onPlayOnline   — called with (numOpponents) to enter online matchmaking
//   onOpenSettings — opens the settings panel
//   minPlayers     — smallest allowed total players (from /api/config; default 3)
//   maxPlayers     — largest allowed total players (from /api/config; default 7)
export default function Lobby({ username, onStart, onPlayOnline, onCreateRoom, onJoinRoom, onOpenSettings, onHowToPlay, minPlayers = 3, maxPlayers = 7 }) {
  // Player counts are TOTAL players (including the person selecting), so the
  // smallest option is the minimum room size — never a confusing "1".
  const lo = Math.max(2, minPlayers);
  const hi = Math.max(lo, maxPlayers);
  const totalRange = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  const [players, setPlayers] = useState(() => Math.min(Math.max(4, lo), hi));   // offline total
  const [showOnline, setShowOnline] = useState(false);
  const [onlineMode, setOnlineMode] = useState('menu');                          // 'menu' | 'quick' | 'friends' | 'create' | 'join'
  const [onlinePlayers, setOnlinePlayers] = useState(lo);                        // online total (quick match / create)
  const [joinCode, setJoinCode] = useState('');                                  // code entered to join a private room
  const [showPractice, setShowPractice] = useState(false);                       // practice intro popup
  const total = players;

  // Keep selections inside the allowed range if config arrives/changes after mount.
  useEffect(() => {
    setPlayers(p => Math.min(Math.max(p, lo), hi));
    setOnlinePlayers(p => Math.min(Math.max(p, lo), hi));
  }, [lo, hi]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#829191',
      fontFamily: 'Verdana, sans-serif', color: '#14532d', padding: 16,
    }}>
      {/* Header — brand centered, how-to (left) and profile (right) */}
      <div style={{ display: 'flex', alignItems: 'center', maxWidth: 440, margin: '0 auto 20px' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onHowToPlay} title="How to play" style={{
            background: '#ffffff', border: '1px solid #00000033', color: '#111',
            borderRadius: 8, width: 34, height: 32, cursor: 'pointer', fontSize: 16, fontWeight: 700,
          }}>?</button>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <Logo size={42} showText={false} />
          <div style={{ textAlign: 'left', lineHeight: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: '#111' }}>ACE</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2, color: '#111', marginTop: 3 }}>THE LAST HAND</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onOpenSettings} title="Profile" style={{
            background: '#ffffff', border: '1px solid #00000033', color: '#111',
            borderRadius: 8, width: 34, height: 32, cursor: 'pointer', fontSize: 16,
          }}>👤</button>
        </div>
      </div>

      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, color: '#111', marginBottom: 6 }}>
          How many players?
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#000000aa', marginBottom: 20 }}>
          including you (you + {players - 1} {players - 1 === 1 ? 'opponent' : 'opponents'})
        </div>

        {/* Total player count grid (includes you) */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(totalRange.length, 6)},1fr)`, gap: 8, marginBottom: 24 }}>
          {totalRange.map(n => (
            <button key={n} onClick={() => setPlayers(n)} style={{
              aspectRatio: '1', borderRadius: 12, cursor: 'pointer',
              border: players === n ? '2.5px solid #15803d' : '1.5px solid #00000033',
              background: players === n ? 'linear-gradient(160deg,#16a34a,#15803d)' : '#ffffff',
              color: players === n ? '#fff' : '#111',
              fontSize: 24, fontWeight: 700, fontFamily: 'Verdana, sans-serif',
              boxShadow: players === n ? '0 6px 18px #16a34a55' : '0 1px 3px #16653422',
              transition: 'all 0.15s',
              transform: players === n ? 'scale(1.05)' : 'scale(1)',
            }}>{n}</button>
          ))}
        </div>

        <TablePreview total={total} username={username} />

        <div style={{ textAlign: 'center', color: '#111', fontSize: 13, margin: '18px 0 24px' }}>
          {total} players · 52 cards dealt{' '}
          <span style={{ color: '#dc2626' }}>~{Math.floor(52 / total)}–{Math.ceil(52 / total)} each</span>
        </div>

        {/* Online multiplayer CTA — above Deal & Start */}
        <button onClick={() => { setOnlineMode('menu'); setJoinCode(''); setShowOnline(true); }} style={{
          width: '100%', padding: 13, borderRadius: 12, marginBottom: 12,
          border: '1.5px solid #38bdf8', background: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
          color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Verdana, sans-serif', letterSpacing: 1,
          cursor: 'pointer', boxShadow: '0 5px 16px #0ea5e944',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          🌐 Play Online
        </button>

        <button onClick={() => onStart(players - 1, AI_ENABLED)} style={{
          width: '100%', padding: 15, borderRadius: 12, border: 'none',
          background: 'linear-gradient(160deg,#16a34a,#15803d)', color: '#fff',
          fontSize: 17, fontWeight: 700, fontFamily: 'Verdana, sans-serif', letterSpacing: 1,
          cursor: 'pointer', boxShadow: '0 6px 20px #16a34a44',
        }}>
          Deal & Start · Offline ♠
        </button>

        {/* Practice mode — coach highlights the best card and explains why */}
        <button onClick={() => setShowPractice(true)} style={{
          width: '100%', padding: 13, borderRadius: 12, marginTop: 12,
          border: '1.5px solid #38bdf8', background: '#0a2233', color: '#e0f2fe',
          fontSize: 15, fontWeight: 700, fontFamily: 'Verdana, sans-serif', letterSpacing: 0.5,
          cursor: 'pointer', boxShadow: '0 4px 14px #0ea5e933',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
          <span>🎓 Practice with Coach</span>
          <span style={{ fontSize: 10.5, fontWeight: 400, color: '#7dd3fc99', letterSpacing: 0 }}>
            we highlight the best card to drop &amp; tell you why
          </span>
        </button>
      </div>

      {/* Practice intro — sets expectations before starting a coached game */}
      {showPractice && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, background: '#000000aa',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#0c2d44', border: '1.5px solid #38bdf8', borderRadius: 16,
            padding: '26px 26px', maxWidth: 360, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>🎓</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e0f2fe', marginBottom: 12 }}>
              Practice with Coach
            </div>
            <div style={{ fontSize: 13, color: '#bae6fd', lineHeight: 1.6, marginBottom: 10 }}>
              This mode is here to <strong>teach you</strong>. On every turn we highlight the
              best card to drop and explain the reasoning behind it.
            </div>
            <div style={{ fontSize: 13, color: '#7dd3fc', lineHeight: 1.6, marginBottom: 14 }}>
              Once it starts to click, <strong>stop leaning on the coach</strong> — play a
              real game and think through the moves yourself. That's how you actually get good. 💪
            </div>
            <div style={{
              fontSize: 12, color: '#e0f2fe', lineHeight: 1.5, marginBottom: 20,
              background: '#0a223399', border: '1px solid #1e6a8e', borderRadius: 8, padding: '9px 11px',
            }}>
              📖 New here? Read the{' '}
              <button onClick={() => { setShowPractice(false); onHowToPlay?.(); }} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: '#7dd3fc', fontWeight: 700, textDecoration: 'underline', fontFamily: 'Verdana, sans-serif', fontSize: 12,
              }}>How to Play</button>{' '}guide first if you haven't already.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowPractice(false)} style={{
                background: 'transparent', border: '1.5px solid #38bdf866', color: '#7dd3fc',
                borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif',
              }}>Cancel</button>
              <button onClick={() => { setShowPractice(false); onStart(players - 1, AI_ENABLED, true); }} style={{
                background: 'linear-gradient(135deg,#0ea5e9,#0369a1)', border: 'none', color: '#fff',
                borderRadius: 8, padding: '10px 26px', cursor: 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
              }}>Let's learn →</button>
            </div>
          </div>
        </div>
      )}

      {/* Online overlay — pick how to play online */}
      {showOnline && (() => {
        const PlayerGrid = () => (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(totalRange.length, 6)},1fr)`, gap: 8, marginBottom: 16 }}>
              {totalRange.map(n => {
                const selected = onlinePlayers === n;
                return (
                  <button key={n} onClick={() => setOnlinePlayers(n)} style={{
                    aspectRatio: '1', borderRadius: 12, cursor: 'pointer',
                    border: selected ? '2.5px solid #fbbf24' : '1.5px solid #1e6a8e',
                    background: selected ? 'linear-gradient(160deg,#0ea5e9,#0369a1)' : '#0a2233',
                    color: '#e0f2fe',
                    fontSize: 22, fontWeight: 700, fontFamily: 'Verdana, sans-serif',
                  }}>{n}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: '#7dd3fc', marginBottom: 18 }}>
              <strong>{onlinePlayers} players</strong> — you + {onlinePlayers - 1} {onlinePlayers - 1 === 1 ? 'other' : 'others'}
            </div>
          </>
        );

        const cancelBtn = (label = 'Cancel', onClick = () => setShowOnline(false)) => (
          <button onClick={onClick} style={{
            background: 'transparent', border: '1.5px solid #38bdf866', color: '#7dd3fc',
            borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif',
          }}>{label}</button>
        );
        const goBtn = (label, onClick, disabled = false) => (
          <button onClick={onClick} disabled={disabled} style={{
            background: disabled ? '#1e425a' : 'linear-gradient(135deg,#0ea5e9,#0369a1)', border: 'none',
            color: disabled ? '#5b8299' : '#fff', borderRadius: 8, padding: '10px 26px',
            cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif', fontWeight: 700,
          }}>{label}</button>
        );

        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50, background: '#000000aa',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <div style={{
              background: '#0c2d44', border: '1.5px solid #38bdf8', borderRadius: 16,
              padding: '26px 26px', maxWidth: 360, width: '100%', textAlign: 'center',
            }}>
              <div style={{ fontSize: 34, marginBottom: 6 }}>🌐</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e0f2fe', marginBottom: 14 }}>Play Online</div>

              {/* Menu: random match vs. playing with friends */}
              {onlineMode === 'menu' && (
                <>
                  <button onClick={() => setOnlineMode('quick')} style={menuBtnStyle}>
                    <div style={menuBtnTitle}>⚡ Quick Match</div>
                    <div style={menuBtnDesc}>Match with random online players</div>
                  </button>
                  <button onClick={() => setOnlineMode('friends')} style={menuBtnStyle}>
                    <div style={menuBtnTitle}>👥 Play with Friends</div>
                    <div style={menuBtnDesc}>Create a private room or join one with a code</div>
                  </button>
                  <div style={{ marginTop: 8 }}>{cancelBtn('Close')}</div>
                </>
              )}

              {/* Friends: choose create or join */}
              {onlineMode === 'friends' && (
                <>
                  <button onClick={() => setOnlineMode('create')} style={menuBtnStyle}>
                    <div style={menuBtnTitle}>➕ Create Room</div>
                    <div style={menuBtnDesc}>Start a private room and get a code for friends</div>
                  </button>
                  <button onClick={() => setOnlineMode('join')} style={menuBtnStyle}>
                    <div style={menuBtnTitle}>🔑 Join with Code</div>
                    <div style={menuBtnDesc}>Enter a friend's room code to join them</div>
                  </button>
                  <div style={{ marginTop: 8 }}>{cancelBtn('← Back', () => setOnlineMode('menu'))}</div>
                </>
              )}

              {/* Quick match — pick size, then matchmake */}
              {onlineMode === 'quick' && (
                <>
                  <div style={{ fontSize: 12.5, color: '#7dd3fc', marginBottom: 18 }}>
                    How many players? (including you)
                  </div>
                  <PlayerGrid />
                  <div style={{ fontSize: 11, color: '#7dd3fc99', marginBottom: 18 }}>
                    everyone must pick the same size to match
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    {cancelBtn('← Back', () => setOnlineMode('menu'))}
                    {goBtn('Find Match →', () => { setShowOnline(false); onPlayOnline?.(onlinePlayers - 1); })}
                  </div>
                </>
              )}

              {/* Create a private room — pick size, then wait for a code */}
              {onlineMode === 'create' && (
                <>
                  <div style={{ fontSize: 12.5, color: '#7dd3fc', marginBottom: 18 }}>
                    Room size? (including you)
                  </div>
                  <PlayerGrid />
                  <div style={{ fontSize: 11, color: '#7dd3fc99', marginBottom: 18 }}>
                    you'll get a code — the game starts when the room fills
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    {cancelBtn('← Back', () => setOnlineMode('friends'))}
                    {goBtn('Create Room →', () => { setShowOnline(false); onCreateRoom?.(onlinePlayers - 1); })}
                  </div>
                </>
              )}

              {/* Join an existing private room by code */}
              {onlineMode === 'join' && (
                <>
                  <div style={{ fontSize: 12.5, color: '#7dd3fc', marginBottom: 18 }}>
                    Enter the room code your friend shared
                  </div>
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onKeyDown={e => e.key === 'Enter' && joinCode.length === 4 && (setShowOnline(false), onJoinRoom?.(joinCode))}
                    placeholder="0000" inputMode="numeric" maxLength={4} autoFocus
                    style={{
                      width: '100%', boxSizing: 'border-box', textAlign: 'center',
                      fontSize: 34, letterSpacing: 14, fontFamily: 'Verdana, sans-serif',
                      padding: '12px 0', borderRadius: 10, marginBottom: 18,
                      background: '#0a2233', color: '#fff', border: '1.5px solid #1e6a8e', outline: 'none',
                    }} />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    {cancelBtn('← Back', () => setOnlineMode('friends'))}
                    {goBtn('Join →', () => { setShowOnline(false); onJoinRoom?.(joinCode); }, joinCode.length !== 4)}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
