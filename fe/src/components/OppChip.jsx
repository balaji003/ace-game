import { NAMES } from '../constants';

// Opponent avatar shown around the arena arc.
// Props:
//   idx       — player index (1+)
//   game      — full game state
//   cur       — index of the player whose turn it is
//   aiStatus  — truthy string while AI is thinking
//   names     — seat labels (defaults to the offline NAMES; online passes real usernames)
//   scale     — size multiplier (Arena scales chips with the board width)
//   style     — positioning (left/top set by Arena)
export default function OppChip({ idx, game, cur, aiStatus, names = NAMES, scale = 1, style }) {
  const hand = game.hands[idx];
  const isActive = cur === idx;
  const isDone = game.finished.includes(idx);
  const isThinking = !!aiStatus && isActive;
  const visibleCards = Math.min(hand.length, 6);

  // Card-back dimensions scale with the board.
  const cw = Math.round(40 * scale);
  const ch = Math.round(54 * scale);
  const nameFont = Math.round(10 * scale);
  const countFont = Math.round(10 * scale);

  return (
    <div style={{
      position: 'absolute',
      transform: 'translate(-50%,-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      width: Math.round(60 * scale),
      ...style,
    }}>
      <div style={{
        fontSize: nameFont, fontWeight: 700,
        color: isActive ? '#fde68a' : isDone ? '#4ade80' : '#cbe6d6',
        background: isActive ? '#fef3c722' : 'transparent',
        padding: '1px 6px', borderRadius: 6, whiteSpace: 'nowrap',
        maxWidth: Math.round(84 * scale), overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {names[idx]} {isDone ? '✅' : isActive ? (isThinking ? '🤖' : '🎯') : ''}
      </div>

      <div style={{ position: 'relative', height: ch, width: cw + 6 }}>
        {hand.length === 0 ? (
          <div style={{
            width: cw - 2, height: ch, borderRadius: 6,
            border: '1px dashed #166534',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(16 * scale), position: 'absolute', left: 2,
          }}>
            ✅
          </div>
        ) : (
          Array.from({ length: visibleCards }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: i * 3, top: i * 1.5 }}>
              <div style={{
                width: cw, height: ch, borderRadius: 6,
                background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
                border: '1.5px solid #1e40af',
                boxShadow: '0 1px 3px #0004',
              }}>
                <div style={{
                  margin: 3, height: 'calc(100% - 6px)', borderRadius: 3,
                  border: '1px solid #60a5fa33',
                  backgroundImage: 'repeating-linear-gradient(45deg,#60a5fa11 0,#60a5fa11 1px,transparent 0,transparent 50%)',
                  backgroundSize: '5px 5px',
                }} />
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{
        fontSize: countFont,
        color: isActive ? '#fde68a' : '#86efac',
        background: '#06281aaa',
        padding: '1px 7px', borderRadius: 8, fontWeight: 700,
      }}>
        {hand.length}
      </div>
    </div>
  );
}
