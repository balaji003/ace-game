import { IS_RED } from '../constants';

// Props:
//   card      — { suit, rank }
//   onClick   — optional click handler
//   tiny      — smaller size (for table display)
//   glow      — amber glow (cut card)
//   highlight — orange highlight (highest in suit)
//   dim       — greyed out (not playable)
export default function CardFace({ card, onClick, glow, dim, tiny, highlight }) {
  const red = IS_RED(card.suit);
  const w = tiny ? 52 : 65;
  const h = tiny ? 72 : 92;

  return (
    <div
      onClick={onClick}
      style={{
        width: w, height: h, borderRadius: 8, flexShrink: 0,
        background: glow ? '#fffbeb' : highlight ? '#fff7ed' : 'linear-gradient(160deg,#fff 70%,#f8fafc)',
        border: glow ? '2.5px solid #f59e0b' : highlight ? '2px solid #f97316' : '1.5px solid #cbd5e1',
        boxShadow: glow ? '0 0 14px #fbbf2488' : highlight ? '0 0 10px #f9731666' : '0 1px 4px #0001',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        opacity: dim ? 0.35 : 1,
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{ position: 'absolute', top: 2, left: 4, fontSize: tiny ? 10 : 12, fontWeight: 700, lineHeight: 1.2, color: red ? '#dc2626' : '#111', fontFamily: 'Georgia,serif' }}>
        {card.rank}<br />{card.suit}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: tiny ? 20 : 26, color: red ? '#dc2626' : '#111', fontFamily: 'Georgia,serif' }}>
        {card.suit}
      </div>
      <div style={{ position: 'absolute', bottom: 2, right: 4, fontSize: tiny ? 10 : 12, fontWeight: 700, lineHeight: 1.2, color: red ? '#dc2626' : '#111', transform: 'rotate(180deg)', fontFamily: 'Georgia,serif' }}>
        {card.rank}<br />{card.suit}
      </div>
    </div>
  );
}
