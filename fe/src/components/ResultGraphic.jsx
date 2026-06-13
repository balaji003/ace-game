import { IS_RED } from '../constants';

// Animated overlay shown during the 'result' phase.
// Props:
//   type      — 'dead' (cards burn) | 'cut' (cards swept to taker)
//   cards     — roundCards array  ({ player, card })
//   takerName — display name of the player who takes the pile (cut only)
//   count     — number of cards in the pile
//   flightDx  — horizontal px the pile flies toward the taker (cut only)
//   flightDy  — vertical px the pile flies toward the taker (cut only)
export default function ResultGraphic({ type, cards, takerName, count, flightDx = 0, flightDy = 150 }) {
  const miniCard = (card, i, extraStyle) => {
    const red = IS_RED(card.suit);
    return (
      <div key={i} style={{
        position: 'absolute', width: 46, height: 64, borderRadius: 6,
        background: 'linear-gradient(160deg,#fff 70%,#f1f5f9)',
        border: '1.5px solid #cbd5e1', boxShadow: '0 3px 10px #0004',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Georgia,serif', fontWeight: 700,
        ...extraStyle,
      }}>
        <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, color: red ? '#dc2626' : '#111' }}>
          {card.rank}{card.suit}
        </span>
        <span style={{ fontSize: 20, color: red ? '#dc2626' : '#111' }}>{card.suit}</span>
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', overflow: 'hidden',
    }}>
      {/* Backdrop flash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: type === 'cut'
          ? 'radial-gradient(circle, #7f1d1d55 0%, transparent 70%)'
          : 'radial-gradient(circle, #1e1b4b66 0%, transparent 70%)',
        animation: 'flashBg 0.5s ease-out',
      }} />

      {/* Animated cards */}
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {cards.map((rc, i) => {
          const card = rc.card || rc;
          const spread = i - (cards.length - 1) / 2;
          if (type === 'dead') {
            return miniCard(card, i, {
              left: spread * 30 - 23, top: -32,
              animation: 'flyDead 1.6s cubic-bezier(.4,0,.6,1) forwards',
              animationDelay: `${i * 0.06}s`,
              '--dx': `${spread * 40}px`,
              '--rot': `${spread * 40}deg`,
            });
          }
          // --cx converges each card to the pile centre; --tx/--ty then fly the pile to the taker
          return miniCard(card, i, {
            left: spread * 30 - 23, top: -32,
            animation: 'flySwept 1.4s cubic-bezier(.4,0,.7,1) forwards',
            animationDelay: `${i * 0.04}s`,
            '--cx': `${-spread * 30}px`,
            '--tx': `${flightDx}px`,
            '--ty': `${flightDy}px`,
          });
        })}
      </div>

      {/* Central emblem */}
      <div style={{
        position: 'absolute',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        animation: 'popEmblem 0.5s cubic-bezier(.2,1.4,.5,1) 0.3s both',
      }}>
        <div style={{ fontSize: 46, filter: 'drop-shadow(0 2px 8px #0008)' }}>
          {type === 'cut' ? '✂️' : '💀'}
        </div>
        <div style={{
          background: type === 'cut'
            ? 'linear-gradient(135deg,#dc2626,#7f1d1d)'
            : 'linear-gradient(135deg,#4338ca,#1e1b4b)',
          border: `2px solid ${type === 'cut' ? '#fca5a5' : '#a5b4fc'}`,
          borderRadius: 10, padding: '7px 16px',
          fontSize: 14, fontWeight: 700, color: '#fff', textAlign: 'center',
          boxShadow: '0 6px 20px #0006', whiteSpace: 'nowrap', fontFamily: 'Georgia,serif',
        }}>
          {type === 'cut' ? `${takerName} takes ${count} cards!` : `${count} cards burned!`}
        </div>
      </div>

      {/* Ember particles for 'dead' */}
      {type === 'dead' && Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', width: 5, height: 5, borderRadius: '50%',
          background: ['#f59e0b', '#ef4444', '#fbbf24'][i % 3],
          left: '50%', top: '50%',
          animation: 'ember 1.4s ease-out forwards',
          animationDelay: `${0.2 + i * 0.05}s`,
          '--ex': `${(Math.random() - 0.5) * 180}px`,
          '--ey': `${-60 - Math.random() * 80}px`,
        }} />
      ))}
    </div>
  );
}
