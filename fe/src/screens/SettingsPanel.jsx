import { useState } from 'react';
import { timeAgo } from '../utils/time';

// Props:
//   username  — logged-in username
//   stats     — stats object from storage
//   onClose   — close the panel
//   onLogout  — log out handler
//   onDelete  — delete account handler
export default function SettingsPanel({ username, stats, onClose, onLogout, onDelete, onOpenHistory }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const winRate = stats?.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: '#021a10cc', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: 'linear-gradient(160deg,#0f3d28,#08291a)',
          border: '1.5px solid #166534', borderRadius: 16,
          padding: 22, boxShadow: '0 20px 60px #0008', fontFamily: 'Georgia,serif',
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

        <button onClick={onOpenHistory} style={{
          width: '100%', padding: 11, borderRadius: 9,
          border: '1.5px solid #16653488', background: '#06281a', color: '#86efac',
          fontSize: 14, fontFamily: 'Georgia,serif', cursor: 'pointer', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span>📜</span> Game History
        </button>

        <button onClick={onLogout} style={{
          width: '100%', padding: 11, borderRadius: 9,
          border: '1.5px solid #16653488', background: '#06281a', color: '#86efac',
          fontSize: 14, fontFamily: 'Georgia,serif', fontWeight: 700, cursor: 'pointer', marginBottom: 10,
        }}>
          Log Out
        </button>

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{
            width: '100%', padding: 11, borderRadius: 9,
            border: '1.5px solid #7f1d1d', background: 'transparent', color: '#fca5a5',
            fontSize: 13, fontFamily: 'Georgia,serif', cursor: 'pointer',
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
                background: '#06281a', color: '#86efac', fontFamily: 'Georgia,serif', cursor: 'pointer', fontSize: 13,
              }}>Cancel</button>
              <button onClick={onDelete} style={{
                flex: 1, padding: 9, borderRadius: 8, border: 'none',
                background: '#dc2626', color: '#fff', fontFamily: 'Georgia,serif', fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}>Delete Forever</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
