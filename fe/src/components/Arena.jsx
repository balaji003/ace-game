import { NAMES, IS_RED } from '../constants';
import CardFace from './CardFace';
import OppChip from './OppChip';
import ResultGraphic from './ResultGraphic';

// The green felt table with opponents seated in an arc above and the centre pile.
// Props:
//   game        — full game state
//   cur         — index of whose turn it is (-1 if not playing)
//   aiStatus    — string shown while AI is thinking (e.g. "Alex is thinking...")
//   highestCard — the roundCards entry currently winning the led suit
export default function Arena({ game, cur, aiStatus, highestCard }) {
  const { n } = game;
  const opponents = n - 1;
  const height = opponents >= 6 ? 320 : opponents >= 5 ? 300 : 280;
  const arcCenterY = 118;
  const arcRy = opponents >= 5 ? 96 : 86;

  // Place opponents evenly along a half-arc from left to right
  const seats = Array.from({ length: opponents }, (_, i) => {
    const idx = i + 1;
    const f = (i + 1) / (opponents + 1);
    const angle = Math.PI - f * Math.PI;
    return {
      idx,
      leftPct: 50 + 42 * Math.cos(angle),
      top: arcCenterY - arcRy * Math.sin(angle),
    };
  });

  // Direction the cut-pile should fly toward the taker's seat.
  // angle = Math.PI * (1 - taker/n) maps player index to arc position.
  // cos(angle): -1=left, 0=center, +1=right
  // sin(angle): 0=sides, 1=top-center
  const getFlightVector = () => {
    const taker = game.nextLeader;
    if (taker === 0) return { flightDx: 0, flightDy: 200 };   // human is below table
    const angle = Math.PI * (1 - taker / n);
    return {
      flightDx: Math.cos(angle) * 150,
      flightDy: -120 - Math.sin(angle) * 70,
    };
  };
  const { flightDx, flightDy } = game.resultType === 'cut'
    ? getFlightVector()
    : { flightDx: 0, flightDy: -150 };

  const borderColor = game.phase === 'result'
    ? (game.resultType === 'cut' ? '#f97316aa' : '#6366f1aa')
    : '#16a34a44';

  return (
    <div style={{
      position: 'relative', width: '100%', height,
      background: 'radial-gradient(ellipse at 50% 42%, #15803d55, #0d3d2200 72%)',
      borderRadius: 14, marginBottom: 4,
    }}>
      {seats.map(s => (
        <OppChip
          key={s.idx}
          idx={s.idx}
          game={game}
          cur={cur}
          aiStatus={aiStatus}
          style={{ left: `${s.leftPct}%`, top: s.top }}
        />
      ))}

      {/* Centre table */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)',
        width: '62%', maxWidth: 340, minHeight: 128,
        background: '#0d4a2eaa', border: `2px solid ${borderColor}`, borderRadius: 12,
        padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 5, transition: 'border 0.3s', overflow: 'hidden',
      }}>
        {game.phase === 'result' && (
          <ResultGraphic
            type={game.resultType}
            cards={game.roundCards}
            takerName={NAMES[game.nextLeader]}
            count={game.roundCards.length}
            flightDx={flightDx}
            flightDy={flightDy}
          />
        )}

        {game.ledSuit && (
          <div style={{ fontSize: 11, color: '#86efac', display: 'flex', alignItems: 'center', gap: 4 }}>
            Led: <span style={{ fontSize: 20, color: IS_RED(game.ledSuit) ? '#fca5a5' : '#f0fdf4', lineHeight: 1 }}>{game.ledSuit}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', alignItems: 'flex-end' }}>
          {game.roundCards.length === 0 ? (
            <div style={{ color: '#4ade8033', fontSize: 12, padding: '6px 0' }}>— table empty —</div>
          ) : (
            game.roundCards.map((rc, i) => {
              const isHighest = highestCard
                && rc.player === highestCard.player
                && rc.card.rank === highestCard.card.rank
                && rc.card.suit === highestCard.card.suit;
              const isCutCard = game.ledSuit && rc.card.suit !== game.ledSuit;
              return (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#86efacaa', marginBottom: 2 }}>{NAMES[rc.player]}</div>
                  <CardFace card={rc.card} tiny highlight={game.phase === 'result' && isHighest} glow={isCutCard} />
                </div>
              );
            })
          )}
        </div>

        {game.phase === 'result' && (
          <div style={{
            background: game.resultType === 'cut' ? '#7f1d1d' : '#1e1b4b',
            border: `1.5px solid ${game.resultType === 'cut' ? '#ef4444' : '#6366f1'}`,
            borderRadius: 8, padding: '5px 10px', textAlign: 'center', fontSize: 11,
            color: game.resultType === 'cut' ? '#fca5a5' : '#a5b4fc', fontWeight: 600,
            maxWidth: 220, animation: 'pulse 1s ease infinite',
          }}>
            {game.resultMsg}
          </div>
        )}

        {game.phase === 'playing' && (
          <div style={{ fontSize: 11, fontStyle: 'italic', color: cur === 0 ? '#fde68a' : '#86efacaa' }}>
            {cur === 0 ? '⭐ Your turn' : aiStatus ? `🤖 ${aiStatus}` : cur >= 0 ? `${NAMES[cur]}'s turn` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
