import { useState, useEffect, useRef } from 'react';
import { IS_RED } from '../constants';

// Props:
//   cards     — array of { suit, rank }
//   validSet  — Set of "suit+rank" strings the player may play this turn
//   isMyTurn  — whether the human player can act now
//   onPlay    — called with the card object when the player clicks a valid card
export default function FannedHand({ cards, validSet, isMyTurn, onPlay }) {
  const [hovered, setHovered] = useState(null);
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(500);

  // Re-measure on resize so the fan always fits without horizontal scroll
  useEffect(() => {
    const measure = () => {
      if (wrapRef.current) setWrapW(wrapRef.current.offsetWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (cards.length === 0) {
    return (
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade8055', fontSize: 13 }}>
        No cards — waiting…
      </div>
    );
  }

  const n = cards.length;
  const W = 56, H = 80;
  const containerH = 150;
  const pivotY = containerH + 220;   // arc pivot far below = gentle curve
  const sidePad = 14;
  const avail = Math.max(wrapW - sidePad * 2, W);

  const maxStep = W - 14;
  const step = n > 1 ? Math.min(maxStep, (avail - W) / (n - 1)) : 0;
  const usedWidth = W + step * (n - 1);

  const maxAngle = Math.min(2.2 * n, 46);
  const angleStep = n > 1 ? maxAngle / (n - 1) : 0;
  const startAngle = -maxAngle / 2;
  const tight = n > 1 && step < 22;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: containerH, userSelect: 'none' }}>
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: usedWidth, height: containerH }}>
        {cards.map((card, i) => {
          const key = card.suit + card.rank;
          const valid = validSet.has(key);
          const isHov = hovered === key;
          const angle = startAngle + i * angleStep;
          const cx = i * step + W / 2;
          const cy = H / 2 + 28;
          const liftY = isHov ? -26 : (valid && isMyTurn) ? -11 : 0;
          const red = IS_RED(card.suit);

          return (
            <div
              key={key}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => valid && isMyTurn && onPlay(card)}
              style={{
                position: 'absolute',
                left: cx - W / 2,
                top: cy - H / 2,
                width: W, height: H,
                transform: `rotate(${angle}deg) translateY(${liftY}px)`,
                transformOrigin: `${W / 2}px ${pivotY}px`,
                transition: 'transform 0.18s ease, box-shadow 0.15s',
                cursor: (valid && isMyTurn) ? 'pointer' : 'default',
                zIndex: isHov ? 1000 : i,
                borderRadius: 7,
                background: valid && isMyTurn
                  ? (isHov ? '#fffbeb' : '#fff')
                  : 'linear-gradient(160deg,#fff 72%,#f1f5f9)',
                border: isHov && valid && isMyTurn
                  ? '2.5px solid #f59e0b'
                  : valid && isMyTurn ? '2px solid #fcd34d' : '1px solid #cbd5e1',
                boxShadow: isHov
                  ? '0 10px 26px #0006, 0 0 18px #fbbf2466'
                  : valid && isMyTurn ? '0 4px 12px #0003' : '0 2px 7px #0002',
                opacity: (isMyTurn && !valid) ? 0.45 : 1,
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 3, left: 4, fontSize: 11, fontWeight: 700, lineHeight: 1.15, color: red ? '#dc2626' : '#111', fontFamily: 'Georgia,serif' }}>
                {card.rank}<br />{card.suit}
              </div>
              {!tight && (
                <>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, color: red ? '#dc2626' : '#111', fontFamily: 'Georgia,serif' }}>
                    {card.suit}
                  </div>
                  <div style={{ position: 'absolute', bottom: 3, right: 4, fontSize: 11, fontWeight: 700, lineHeight: 1.15, color: red ? '#dc2626' : '#111', transform: 'rotate(180deg)', fontFamily: 'Georgia,serif' }}>
                    {card.rank}<br />{card.suit}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 2, right: 6, fontSize: 10, color: '#86efac99' }}>
        {n} cards
      </div>
    </div>
  );
}
