import { NAMES } from '../constants';

// Opponent avatar shown around the arena arc.
// Props:
//   idx       — player index (1+)
//   game      — full game state
//   cur       — index of the player whose turn it is
//   aiStatus  — truthy string while AI is thinking
//   style     — positioning (left/top set by Arena)
export default function OppChip({ idx, game, cur, aiStatus, style }) {
  const hand = game.hands[idx];
  const isActive = cur === idx;
  const isDone = game.finished.includes(idx);
  const isThinking = !!aiStatus && isActive;
  const visibleCards = Math.min(hand.length, 6);

  return (
    <div style={{
      position: 'absolute',
      transform: 'translate(-50%,-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      width: 60,
      ...style,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: isActive ? '#fde68a' : isDone ? '#4ade80' : '#cbe6d6',
        background: isActive ? '#fef3c722' : 'transparent',
        padding: '1px 6px', borderRadius: 6, whiteSpace: 'nowrap',
      }}>
        {NAMES[idx]} {isDone ? '✅' : isActive ? (isThinking ? '🤖' : '🎯') : ''}
      </div>

      <div style={{ position: 'relative', height: 54, width: 46 }}>
        {hand.length === 0 ? (
          <div style={{
            width: 42, height: 54, borderRadius: 6,
            border: '1px dashed #166534',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, position: 'absolute', left: 2,
          }}>
            ✅
          </div>
        ) : (
          Array.from({ length: visibleCards }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: i * 3, top: i * 1.5 }}>
              <div style={{
                width: 40, height: 54, borderRadius: 6,
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
        fontSize: 10,
        color: isActive ? '#fde68a' : '#86efac',
        background: '#06281aaa',
        padding: '1px 7px', borderRadius: 8, fontWeight: 700,
      }}>
        {hand.length}
      </div>
    </div>
  );
}
