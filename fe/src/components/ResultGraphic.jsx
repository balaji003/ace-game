import { IS_RED } from '../constants';
import { RESULT_ANIM_MS } from '../config';

// Animated overlay shown during the 'result' phase. Renders only the flash,
// flying cards and embers — the DEAD/CUT icon + message is a separate banner
// (in Arena) so it never covers the played cards.
// Props:
//   type      — 'dead' (cards burn) | 'cut' (cards swept to taker)
//   cards     — roundCards array  ({ player, card })
//   flightDx  — horizontal px the pile flies toward the taker (cut only)
//   flightDy  — vertical px the pile flies toward the taker (cut only)
//   animMs    — duration of the fly-away animation (defaults to RESULT_ANIM_MS)
export default function ResultGraphic({ type, cards, flightDx = 0, flightDy = 150, animMs = RESULT_ANIM_MS }) {
  const sec = animMs / 1000;
  const miniCard = (card, i, extraStyle) => {
    const red = IS_RED(card.suit);
    return (
      <div key={i} style={{
        position: 'absolute', width: 46, height: 64, borderRadius: 6,
        background: 'linear-gradient(160deg,#fff 70%,#f1f5f9)',
        border: '1.5px solid #cbd5e1', boxShadow: '0 3px 10px #0004',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Verdana, sans-serif', fontWeight: 700,
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
              animation: `flyDead ${sec}s cubic-bezier(.4,0,.6,1) forwards`,
              animationDelay: `${i * 0.06}s`,
              '--dx': `${spread * 40}px`,
              '--rot': `${spread * 40}deg`,
            });
          }
          // --cx converges each card to the pile centre; --tx/--ty then fly the pile to the taker
          return miniCard(card, i, {
            left: spread * 30 - 23, top: -32,
            animation: `flySwept ${sec}s cubic-bezier(.4,0,.7,1) forwards`,
            animationDelay: `${i * 0.04}s`,
            '--cx': `${-spread * 30}px`,
            '--tx': `${flightDx}px`,
            '--ty': `${flightDy}px`,
          });
        })}
      </div>

      {/* Ember particles for 'dead' */}
      {type === 'dead' && Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', width: 5, height: 5, borderRadius: '50%',
          background: ['#f59e0b', '#ef4444', '#fbbf24'][i % 3],
          left: '50%', top: '50%',
          animation: `ember ${sec}s ease-out forwards`,
          animationDelay: `${0.2 + i * 0.05}s`,
          '--ex': `${(Math.random() - 0.5) * 180}px`,
          '--ey': `${-60 - Math.random() * 80}px`,
        }} />
      ))}
    </div>
  );
}
