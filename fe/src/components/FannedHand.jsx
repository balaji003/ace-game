import { useState, useEffect, useRef } from 'react';
import { IS_RED } from '../constants';

const SIDE_PAD = 12;
const MAX_PER_ROW = 11; // wrap sooner so wide rows aren't squeezed

// Props:
//   cards     — array of { suit, rank }
//   validSet  — Set of "suit+rank" strings the player may play this turn
//   isMyTurn  — whether the human player can act now
//   onPlay    — called with the card object when the player clicks a valid card
//
// Fully responsive hand: card size scales to the viewport, cards overlap, and
// the hand wraps onto as many rows as needed — so it fits any screen width and
// any card count (1 up to a full 52-card hand) without ever overflowing.
export default function FannedHand({ cards, validSet, isMyTurn, onPlay }) {
  const [hovered, setHovered] = useState(null);
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(360);

  useEffect(() => {
    const measure = () => { if (wrapRef.current) setWrapW(wrapRef.current.offsetWidth); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (cards.length === 0) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade8055', fontSize: 13 }}>
        No cards — waiting…
      </div>
    );
  }

  const avail = Math.max(wrapW - SIDE_PAD * 2, 140);

  // Responsive card size: shrink on narrow screens, cap on wide ones.
  const W = Math.round(Math.min(56, Math.max(40, avail / 9)));
  const H = Math.round(W * 1.4);

  // Minimum horizontal step keeps each card's top-left rank/suit readable.
  const minStep = Math.max(16, W * 0.42);
  const perRow = Math.min(MAX_PER_ROW, Math.max(1, Math.floor((avail - W) / minStep) + 1));
  const rowCount = Math.ceil(cards.length / perRow);

  // Split as evenly as possible across rows.
  const rows = [];
  let idx = 0;
  for (let r = 0; r < rowCount; r++) {
    const count = Math.floor(cards.length / rowCount) + (r < cards.length % rowCount ? 1 : 0);
    rows.push(cards.slice(idx, idx + count));
    idx += count;
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      {rows.map((rowCards, r) => (
        <FanRow
          key={r}
          rowCards={rowCards}
          avail={avail}
          W={W}
          H={H}
          validSet={validSet}
          isMyTurn={isMyTurn}
          onPlay={onPlay}
          hovered={hovered}
          setHovered={setHovered}
        />
      ))}
    </div>
  );
}

// FanRow lays one row of overlapping cards with a gentle vertical arc (middle
// cards lifted) and a slight rotation around each card's base — no far pivot,
// so the row's footprint stays within `avail` and never clips at the edges.
function FanRow({ rowCards, avail, W, H, validSet, isMyTurn, onPlay, hovered, setHovered }) {
  const n = rowCards.length;
  const topPad = 22;                 // headroom so a hovered/raised card isn't clipped
  const rowH = topPad + H + 8;

  // Reserve a little width for the slight rotation splay so nothing overflows.
  const usable = Math.max(W, avail - 16);
  const maxStep = W * 0.82;          // cap overlap so a few cards don't span edge-to-edge
  const step = n > 1 ? Math.min(maxStep, (usable - W) / (n - 1)) : 0;
  const usedWidth = W + step * (n - 1);

  const tight = step < W * 0.4;      // hide the big centre pip when very overlapped
  const arcAmp = Math.min(12, n * 1.1);
  const maxTilt = Math.min(6, n * 0.8); // degrees at the ends

  return (
    <div style={{ position: 'relative', width: '100%', height: rowH }}>
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: usedWidth, height: rowH }}>
        {rowCards.map((card, i) => {
          const key = card.suit + card.rank;
          const valid = validSet.has(key);
          const isHov = hovered === key;
          const red = IS_RED(card.suit);

          // -1 (left) … 0 (centre) … 1 (right)
          const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
          const arc = -arcAmp * (1 - t * t);          // raise the middle
          const tilt = t * maxTilt;                   // subtle fan tilt
          const lift = isHov ? -20 : (valid && isMyTurn) ? -8 : 0;
          const cardTop = topPad + arc + lift;
          const fontMain = Math.round(W * 0.38);
          const fontPip = Math.round(W * 0.2);

          return (
            <div
              key={key}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => valid && isMyTurn && onPlay(card)}
              style={{
                position: 'absolute',
                left: i * step,
                top: cardTop,
                width: W, height: H,
                transform: `rotate(${tilt}deg)`,
                transformOrigin: `${W / 2}px ${H}px`,
                transition: 'top 0.15s ease, box-shadow 0.15s',
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
              <div style={{ position: 'absolute', top: 2, left: 4, fontSize: fontPip, fontWeight: 700, lineHeight: 1.1, color: red ? '#dc2626' : '#111', fontFamily: 'Georgia,serif' }}>
                {card.rank}<br />{card.suit}
              </div>
              {!tight && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fontMain, color: red ? '#dc2626' : '#111', fontFamily: 'Georgia,serif' }}>
                  {card.suit}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
