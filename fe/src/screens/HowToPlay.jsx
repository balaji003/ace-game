import CardFace from '../components/CardFace';

// Standalone "How to Play" reference. Reachable from the login screen and from a
// persistent "?" icon on the lobby, so a player can read the rules any time.
//
// Props:
//   onBack — return to the previous screen

const SECTION_TITLE = {
  fontSize: 13, color: '#86efac', letterSpacing: 1.5, fontWeight: 700,
  textTransform: 'uppercase', marginBottom: 8, marginTop: 26,
};
const PARA = { fontSize: 14, color: '#dcfce7', lineHeight: 1.7, marginBottom: 10 };
const HL = { color: '#fde68a', fontWeight: 700 };

// One captioned scenario panel: a row of cards + an explanation underneath.
function Scenario({ accent, badge, title, cards, caption }) {
  return (
    <div style={{
      background: '#06281a', border: `1.5px solid ${accent}55`, borderRadius: 14,
      padding: '16px 14px', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{badge}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: accent }}>{title}</span>
      </div>
      <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <CardFace card={c} tiny highlight={c._highest} glow={c._cut} />
            <div style={{ fontSize: 9.5, color: '#86efac99', marginTop: 4, maxWidth: 56 }}>{c._label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: '#bbf7d0', lineHeight: 1.6 }}>{caption}</div>
    </div>
  );
}

export default function HowToPlay({ onBack }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto',
      background: 'radial-gradient(ellipse at 50% 0%,#0f4d2a,#061a0f 70%)',
      fontFamily: 'Georgia,serif', color: '#fff',
    }}>
      {/* Sticky header with back button */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        background: '#061a0fdd', backdropFilter: 'blur(6px)', borderBottom: '1px solid #16653455',
      }}>
        <button onClick={onBack} style={{
          background: '#0f3d28', border: '1px solid #4ade8066', color: '#4ade80',
          borderRadius: 8, width: 36, height: 34, cursor: 'pointer', fontSize: 18,
        }}>←</button>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', letterSpacing: 1 }}>How to Play ♠</div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '8px 18px 48px' }}>

        <div style={{ ...PARA, marginTop: 18, fontSize: 15, color: '#f0fdf4' }}>
          <strong>ACE</strong> is a cutthroat card game. The whole deck is dealt out, and
          the aim is simple: <span style={HL}>get rid of all your cards</span>. Be the last
          one still holding cards and you <span style={HL}>lose</span>.
        </div>

        <div style={SECTION_TITLE}>Setup</div>
        <div style={PARA}>
          All <span style={HL}>52 cards</span> are dealt evenly among 3–7 players. Whoever is
          dealt the <span style={HL}>Ace of Spades (A♠)</span> plays first.
        </div>

        <div style={SECTION_TITLE}>A round</div>
        <div style={PARA}>
          The leader plays any card. Its suit becomes the <span style={HL}>led suit</span> for
          that round. Going in turn, every other player <span style={HL}>must follow suit</span>
          {' '}— play a card of the led suit — if they have one.
        </div>
        <div style={PARA}>
          If you have <span style={HL}>no card of the led suit</span>, you may throw any other
          card. That's called a <span style={HL}>cut</span> (a "break"), and it changes
          everything — see below.
        </div>

        <div style={SECTION_TITLE}>How a round ends</div>

        <Scenario
          accent="#38bdf8"
          badge="💀"
          title="Dead cards — everyone followed suit"
          cards={[
            { suit: '♠', rank: '7',  _label: 'leader' },
            { suit: '♠', rank: 'K',  _label: 'highest', _highest: true },
            { suit: '♠', rank: '4',  _label: '' },
            { suit: '♠', rank: '9',  _label: '' },
          ]}
          caption={<>Nobody cut — all four played ♠. The cards are <strong>dead</strong>: thrown
            out of the game for good. The player who played the highest led-suit card
            (<strong>K♠</strong>) leads the next round. This is the good outcome — cards
            leave the game.</>}
        />

        <Scenario
          accent="#f59e0b"
          badge="✂️"
          title="Cut / break — someone couldn't follow"
          cards={[
            { suit: '♠', rank: '7',  _label: 'led' },
            { suit: '♠', rank: 'K',  _label: 'highest ♠', _highest: true },
            { suit: '♥', rank: '5',  _label: 'cut!', _cut: true },
          ]}
          caption={<>A player had no ♠, so they <strong>cut</strong> with 5♥. The round stops
            immediately. Whoever played the <strong>highest card of the led suit so far</strong>
            {' '}(<strong>K♠</strong>) must <strong>pick up every card</strong> in the round —
            they all go into their hand. That player then leads next. This is the painful
            outcome — someone gains cards instead of shedding them.</>}
        />

        <div style={SECTION_TITLE}>Finishing & losing</div>
        <div style={PARA}>
          When you play your <span style={HL}>last card</span> you're out and safe. Play
          continues until only <span style={HL}>one player</span> is left holding cards — that
          player is the <span style={HL}>loser</span>.
        </div>

        <div style={SECTION_TITLE}>Tips</div>
        <div style={PARA}>
          • Running out of a suit lets you <span style={HL}>cut</span> — a powerful way to dump
          cards and dodge picking up.<br />
          • Holding a high card in the led suit is risky: if someone cuts, you could be the one
          who <span style={HL}>scoops the whole pile</span>.<br />
          • Watch which suits opponents stop playing — that's a sign they're about to cut.
        </div>

        <button onClick={onBack} style={{
          width: '100%', marginTop: 24, padding: 14, borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff',
          fontSize: 16, fontWeight: 700, fontFamily: 'Georgia,serif', letterSpacing: 1,
          cursor: 'pointer', boxShadow: '0 6px 20px #16a34a44',
        }}>Got it ♠</button>
      </div>
    </div>
  );
}
