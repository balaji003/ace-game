import { useState } from 'react';
import { AI_ENABLED } from '../config';
import TablePreview from '../components/TablePreview';

// Props:
//   username       — logged-in username
//   onStart        — called with (numOpponents, useAI)
//   onOpenSettings — opens the settings panel
export default function Lobby({ username, onStart, onOpenSettings }) {
  const [opponents, setOpponents] = useState(3);
  const [useAI, setUseAI] = useState(AI_ENABLED);
  const total = opponents + 1;

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
        <div style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, color: '#f0fdf4', marginBottom: 24 }}>
          How many opponents?
        </div>

        {/* Opponent count grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 24 }}>
          {[3, 4, 5, 6, 7].map(n => (
            <button key={n} onClick={() => setOpponents(n)} style={{
              aspectRatio: '1', borderRadius: 12, cursor: 'pointer',
              border: opponents === n ? '2.5px solid #fbbf24' : '1.5px solid #16653488',
              background: opponents === n ? 'linear-gradient(160deg,#16a34a,#15803d)' : '#0f3d28',
              color: opponents === n ? '#fff' : '#86efac',
              fontSize: 24, fontWeight: 700, fontFamily: 'Georgia,serif',
              boxShadow: opponents === n ? '0 6px 18px #16a34a55' : 'none',
              transition: 'all 0.15s',
              transform: opponents === n ? 'scale(1.05)' : 'scale(1)',
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

        <button onClick={() => onStart(opponents, AI_ENABLED && useAI)} style={{
          width: '100%', padding: 15, borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff',
          fontSize: 17, fontWeight: 700, fontFamily: 'Georgia,serif', letterSpacing: 1,
          cursor: 'pointer', boxShadow: '0 6px 20px #16a34a44',
        }}>
          Deal & Start ♠
        </button>
      </div>
    </div>
  );
}
