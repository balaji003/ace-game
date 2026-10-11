import { useState } from 'react';
import { timeAgo } from '../utils/time';
import { isMuted, setMuted, sounds } from '../native/sound';
import * as haptics from '../native/haptics';

// A pill switch. Styled to match the panel's inline-style convention rather
// than pulling in a UI library for two toggles.
function Toggle({ label, icon, on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', marginBottom: 8, borderRadius: 9,
        border: '1.5px solid #16653488', background: '#06281a',
        color: '#86efac', fontFamily: 'Verdana, sans-serif', fontSize: 14,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{
        width: 42, height: 24, borderRadius: 12, flexShrink: 0,
        background: on ? '#16a34a' : '#0a3a26',
        border: `1px solid ${on ? '#22c55e' : '#16653488'}`,
        position: 'relative', transition: 'background 140ms ease',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 20 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: on ? '#fff' : '#86efac66',
          transition: 'left 140ms ease',
        }} />
      </span>
    </button>
  );
}

// Props:
//   username  — logged-in username
//   stats     — stats object from storage
//   onClose   — close the panel
//   onLogout  — log out handler
//   onDelete  — delete account handler
export default function SettingsPanel({ username, stats, onClose, onLogout, onDelete, onOpenHistory }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Mirror the persisted flags into state so the switches re-render. The
  // modules stay the source of truth; these are just a view of them.
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [hapticsOn, setHapticsOn] = useState(haptics.isEnabled());
  const winRate = stats?.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  // Preview the thing being switched on, so the toggle confirms itself.
  const toggleSound = (on) => {
    setMuted(!on);
    setSoundOn(on);
    if (on) sounds.turn();
  };

  const toggleHaptics = (on) => {
    haptics.setEnabled(on);
    setHapticsOn(on);
    if (on) haptics.tap();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: '#000000aa', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 'calc(40px + env(safe-area-inset-top)) 16px calc(40px + env(safe-area-inset-bottom))', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: 'linear-gradient(160deg,#0f3d28,#08291a)',
          border: '1.5px solid #166534', borderRadius: 16,
          padding: 22, boxShadow: '0 20px 60px #0008', fontFamily: 'Verdana, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: '#86efac99', letterSpacing: 1 }}>SIGNED IN AS</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80' }}>@{username}</div>
          </div>
          <button onClick={onClose} style={{
            background: '#06281a', border: '1px solid #16653488', color: '#86efac',
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16,
          }}>✕</button>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
          {[['Played', stats?.played || 0], ['Wins', stats?.wins || 0], ['Win %', winRate + '%']].map(([label, value]) => (
            <div key={label} style={{ background: '#06281a', borderRadius: 10, padding: '10px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{value}</div>
              <div style={{ fontSize: 9, color: '#86efac99', letterSpacing: 0.5, marginTop: 2 }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Game history */}
        <div style={{ fontSize: 11, color: '#86efac99', letterSpacing: 1, marginBottom: 8 }}>RECENT GAMES</div>
        <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {(!stats || !stats.history?.length) ? (
            <div style={{ color: '#86efac66', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>No games yet — play one!</div>
          ) : (
            stats.history.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#06281a', borderRadius: 8, padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{h.won ? '🏆' : '💀'}</span>
                  <div>
                    <div style={{ fontSize: 13, color: h.won ? '#4ade80' : '#fca5a5', fontWeight: 700 }}>
                      {h.won ? 'Won' : 'Lost'}{' '}
                      <span style={{ color: '#86efac88', fontWeight: 400 }}>· {h.mode}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#86efac77' }}>vs {h.opponents.join(', ')}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#86efac77' }}>{timeAgo(h.at)}</div>
              </div>
            ))
          )}
        </div>

        {/* Preferences */}
        <div style={{ fontSize: 11, color: '#86efac99', letterSpacing: 1, marginBottom: 8 }}>PREFERENCES</div>
        <Toggle label="Sound" icon="🔊" on={soundOn} onChange={toggleSound} />
        <Toggle label="Vibration" icon="📳" on={hapticsOn} onChange={toggleHaptics} />
        <div style={{ height: 10 }} />

        <button onClick={onOpenHistory} style={{
          width: '100%', padding: 11, borderRadius: 9,
          border: '1.5px solid #16653488', background: '#06281a', color: '#86efac',
          fontSize: 14, fontFamily: 'Verdana, sans-serif', cursor: 'pointer', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span>📜</span> Game History
        </button>

        <button onClick={onLogout} style={{
          width: '100%', padding: 11, borderRadius: 9,
          border: '1.5px solid #16653488', background: '#06281a', color: '#86efac',
          fontSize: 14, fontFamily: 'Verdana, sans-serif', fontWeight: 700, cursor: 'pointer', marginBottom: 10,
        }}>
          Log Out
        </button>

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{
            width: '100%', padding: 11, borderRadius: 9,
            border: '1.5px solid #7f1d1d', background: 'transparent', color: '#fca5a5',
            fontSize: 13, fontFamily: 'Verdana, sans-serif', cursor: 'pointer',
          }}>
            Delete Account
          </button>
        ) : (
          <div style={{ background: '#2d0a0a', border: '1.5px solid #7f1d1d', borderRadius: 9, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 10, textAlign: 'center' }}>
              Permanently delete @{username} and all stats? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)} style={{
                flex: 1, padding: 9, borderRadius: 8, border: '1px solid #16653488',
                background: '#06281a', color: '#86efac', fontFamily: 'Verdana, sans-serif', cursor: 'pointer', fontSize: 13,
              }}>Cancel</button>
              <button onClick={onDelete} style={{
                flex: 1, padding: 9, borderRadius: 8, border: 'none',
                background: '#dc2626', color: '#fff', fontFamily: 'Verdana, sans-serif', fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}>Delete Forever</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
