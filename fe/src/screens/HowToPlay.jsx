import { useState } from 'react';
import CardFace from '../components/CardFace';

// Standalone "How to Play" reference. Reachable from the login screen and from a
// persistent "?" icon on the lobby, so a player can read the rules any time.
// A language dropdown (top-right) switches the same content between English and
// Tamil — card symbols/ranks (♠, K♠ …) stay as-is in both.
//
// Props:
//   onBack — return to the previous screen

const SECTION_TITLE = {
  fontSize: 13, color: '#86efac', letterSpacing: 1.5, fontWeight: 700,
  textTransform: 'uppercase', marginBottom: 8, marginTop: 26,
};
const PARA = { fontSize: 14, color: '#dcfce7', lineHeight: 1.7, marginBottom: 10 };
const HL = { color: '#fde68a', fontWeight: 700 };

// All translatable copy, keyed by language. JSX is used directly so inline
// emphasis (highlights, <strong>) survives translation. Card labels are arrays
// matching the card rows in each scenario.
const STR = {
  en: {
    label: 'English',
    header: 'How to Play ♠',
    intro: <><strong>ACE</strong> is a cutthroat card game. The whole deck is dealt out, and
      the aim is simple: <span style={HL}>get rid of all your cards</span>. Be the last
      one still holding cards and you <span style={HL}>lose</span>.</>,
    setupTitle: 'Setup',
    setup: <>All <span style={HL}>52 cards</span> are dealt evenly among 3–7 players. Whoever is
      dealt the <span style={HL}>Ace of Spades (A♠)</span> plays first.</>,
    roundTitle: 'A round',
    round1: <>The leader plays any card. Its suit becomes the <span style={HL}>led suit</span> for
      that round. Going in turn, every other player <span style={HL}>must follow suit</span>
      {' '}— play a card of the led suit — if they have one.</>,
    round2: <>If you have <span style={HL}>no card of the led suit</span>, you may throw any other
      card. That's called a <span style={HL}>cut</span> (a "break"), and it changes
      everything — see below.</>,
    endsTitle: 'How a round ends',
    deadTitle: 'Dead cards — everyone followed suit',
    deadLabels: ['leader', 'highest', '', ''],
    deadCaption: <>Nobody cut — all four played ♠. The cards are <strong>dead</strong>: thrown
      out of the game for good. The player who played the highest led-suit card
      (<strong>K♠</strong>) leads the next round. This is the good outcome — cards
      leave the game.</>,
    cutTitle: 'Cut / break — someone couldn’t follow',
    cutLabels: ['led', 'highest ♠', 'cut!'],
    cutCaption: <>A player had no ♠, so they <strong>cut</strong> with 5♥. The round stops
      immediately. Whoever played the <strong>highest card of the led suit so far</strong>
      {' '}(<strong>K♠</strong>) must <strong>pick up every card</strong> in the round —
      they all go into their hand. That player then leads next. This is the painful
      outcome — someone gains cards instead of shedding them.</>,
    finishTitle: 'Finishing & losing',
    finish: <>When you play your <span style={HL}>last card</span> you're out and safe. Play
      continues until only <span style={HL}>one player</span> is left holding cards — that
      player is the <span style={HL}>loser</span>.</>,
    tipsTitle: 'Tips',
    tips: <>• Running out of a suit lets you <span style={HL}>cut</span> — a powerful way to dump
      cards and dodge picking up.<br />
      • Holding a high card in the led suit is risky: if someone cuts, you could be the one
      who <span style={HL}>scoops the whole pile</span>.<br />
      • Watch which suits opponents stop playing — that's a sign they're about to cut.</>,
    gotIt: 'Got it ♠',
  },
  ta: {
    label: 'தமிழ்',
    header: 'எப்படி விளையாடுவது ♠',
    intro: <><strong>ACE</strong> என்பது ஒரு வெட்டி வீழ்த்தும் சீட்டு விளையாட்டு. முழு சீட்டுக் கட்டும்
      பகிர்ந்தளிக்கப்படும், நோக்கம் எளிது: <span style={HL}>உங்கள் சீட்டுகள் அனைத்தையும் கழித்துவிடுங்கள்</span>.
      சீட்டுகளை வைத்திருக்கும் கடைசி ஆள் நீங்களாக இருந்தால் நீங்கள் <span style={HL}>தோற்கிறீர்கள்</span>.</>,
    setupTitle: 'தயாரிப்பு',
    setup: <>மொத்தம் <span style={HL}>52 சீட்டுகளும்</span> 3–7 விளையாட்டாளர்களுக்கு சமமாகப் பகிர்ந்தளிக்கப்படும்.
      <span style={HL}> ஸ்பேட் ஏஸ் (A♠)</span> கிடைத்தவர் முதலில் விளையாடுவார்.</>,
    roundTitle: 'ஒரு சுற்று',
    round1: <>தலைவர் எந்த சீட்டையும் போடலாம். அதன் வகை அந்த சுற்றுக்கான <span style={HL}>வழிநடத்தும் வகை</span>
      ஆகிறது. முறை வரிசையில், மற்ற ஒவ்வொரு விளையாட்டாளரும் தங்களிடம் இருந்தால்
      {' '}<span style={HL}>அதே வகையைப் பின்பற்ற வேண்டும்</span> — வழிநடத்தும் வகையின் ஒரு சீட்டைப் போட வேண்டும்.</>,
    round2: <>வழிநடத்தும் வகையின் <span style={HL}>சீட்டு உங்களிடம் இல்லையென்றால்</span>, வேறு எந்த சீட்டையும்
      போடலாம். அதைத்தான் <span style={HL}>வெட்டு</span> ("break") என்கிறோம், அது அனைத்தையும் மாற்றிவிடும்
      — கீழே பாருங்கள்.</>,
    endsTitle: 'ஒரு சுற்று எப்படி முடிகிறது',
    deadTitle: 'செத்த சீட்டுகள் — அனைவரும் வகையைப் பின்பற்றினர்',
    deadLabels: ['தலைவர்', 'மிக உயர்ந்தது', '', ''],
    deadCaption: <>யாரும் வெட்டவில்லை — நான்கு பேரும் ♠ போட்டனர். சீட்டுகள் <strong>செத்துவிட்டன</strong>:
      விளையாட்டிலிருந்து நிரந்தரமாக வெளியேற்றப்படும். வழிநடத்தும் வகையின் மிக உயர்ந்த சீட்டை
      (<strong>K♠</strong>) போட்டவர் அடுத்த சுற்றை வழிநடத்துவார். இது நல்ல முடிவு — சீட்டுகள்
      விளையாட்டை விட்டு வெளியேறும்.</>,
    cutTitle: 'வெட்டு / break — ஒருவரால் பின்பற்ற முடியவில்லை',
    cutLabels: ['வழிநடத்தியது', 'உயர்ந்த ♠', 'வெட்டு!'],
    cutCaption: <>ஒரு விளையாட்டாளரிடம் ♠ இல்லை, அதனால் அவர் 5♥ கொண்டு <strong>வெட்டினார்</strong>. சுற்று
      உடனடியாக நிற்கிறது. இதுவரை <strong>வழிநடத்தும் வகையின் மிக உயர்ந்த சீட்டை</strong>
      {' '}(<strong>K♠</strong>) போட்டவர் சுற்றில் உள்ள <strong>அனைத்து சீட்டுகளையும் எடுத்துக்கொள்ள வேண்டும்</strong>
      {' '}— அவை அனைத்தும் அவரது கையில் சேரும். பிறகு அவரே அடுத்த சுற்றை வழிநடத்துவார். இது வேதனையான
      முடிவு — ஒருவர் சீட்டுகளைக் கழிப்பதற்குப் பதிலாகக் கூடுதலாகப் பெறுகிறார்.</>,
    finishTitle: 'முடித்தல் & தோல்வி',
    finish: <>உங்கள் <span style={HL}>கடைசி சீட்டைப்</span> போடும்போது நீங்கள் வெளியேறிப் பாதுகாப்பாகிவிடுகிறீர்கள்.
      <span style={HL}> ஒரே ஒரு விளையாட்டாளர்</span> மட்டும் சீட்டுகளுடன் மிஞ்சும் வரை விளையாட்டு தொடரும் —
      அந்த ஆளே <span style={HL}>தோல்வியாளர்</span>.</>,
    tipsTitle: 'குறிப்புகள்',
    tips: <>• ஒரு வகை முழுவதும் தீர்ந்துவிட்டால் நீங்கள் <span style={HL}>வெட்டலாம்</span> — சீட்டுகளைக் கொட்டவும்,
      எடுத்துக்கொள்வதைத் தவிர்க்கவும் இது சக்திவாய்ந்த வழி.<br />
      • வழிநடத்தும் வகையில் உயர்ந்த சீட்டை வைத்திருப்பது ஆபத்தானது: யாராவது வெட்டினால், முழுக் குவியலையும்
      {' '}<span style={HL}>அள்ளுபவராக</span> நீங்கள் ஆகிவிடலாம்.<br />
      • எதிராளிகள் எந்த வகைகளை விளையாடுவதை நிறுத்துகிறார்கள் என்பதைக் கவனியுங்கள் — அவர்கள் வெட்டப்
      போகிறார்கள் என்பதற்கான அறிகுறி அது.</>,
    gotIt: 'புரிந்தது ♠',
  },
};

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
  const [lang, setLang] = useState('en');
  const t = STR[lang];

  const deadCards = [
    { suit: '♠', rank: '7' },
    { suit: '♠', rank: 'K', _highest: true },
    { suit: '♠', rank: '4' },
    { suit: '♠', rank: '9' },
  ].map((c, i) => ({ ...c, _label: t.deadLabels[i] }));

  const cutCards = [
    { suit: '♠', rank: '7' },
    { suit: '♠', rank: 'K', _highest: true },
    { suit: '♥', rank: '5', _cut: true },
  ].map((c, i) => ({ ...c, _label: t.cutLabels[i] }));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto',
      background: 'radial-gradient(ellipse at 50% 0%,#0f4d2a,#061a0f 70%)',
      fontFamily: 'Georgia,serif', color: '#fff',
    }}>
      {/* Sticky header: back + title (left), language switcher (right) */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px',
        background: '#061a0fdd', backdropFilter: 'blur(6px)', borderBottom: '1px solid #16653455',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{
            background: '#0f3d28', border: '1px solid #4ade8066', color: '#4ade80',
            borderRadius: 8, width: 36, height: 34, cursor: 'pointer', fontSize: 18,
          }}>←</button>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', letterSpacing: 1 }}>{t.header}</div>
        </div>
        <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language" style={{
          background: '#0f3d28', border: '1px solid #4ade8066', color: '#4ade80',
          borderRadius: 8, padding: '7px 10px', cursor: 'pointer', fontSize: 13,
          fontFamily: 'Georgia,serif', outline: 'none',
        }}>
          {Object.entries(STR).map(([code, v]) => (
            <option key={code} value={code} style={{ color: '#000' }}>{v.label}</option>
          ))}
        </select>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '8px 18px 48px' }}>

        <div style={{ ...PARA, marginTop: 18, fontSize: 15, color: '#f0fdf4' }}>{t.intro}</div>

        <div style={SECTION_TITLE}>{t.setupTitle}</div>
        <div style={PARA}>{t.setup}</div>

        <div style={SECTION_TITLE}>{t.roundTitle}</div>
        <div style={PARA}>{t.round1}</div>
        <div style={PARA}>{t.round2}</div>

        <div style={SECTION_TITLE}>{t.endsTitle}</div>

        <Scenario accent="#38bdf8" badge="💀" title={t.deadTitle} cards={deadCards} caption={t.deadCaption} />
        <Scenario accent="#f59e0b" badge="✂️" title={t.cutTitle} cards={cutCards} caption={t.cutCaption} />

        <div style={SECTION_TITLE}>{t.finishTitle}</div>
        <div style={PARA}>{t.finish}</div>

        <div style={SECTION_TITLE}>{t.tipsTitle}</div>
        <div style={PARA}>{t.tips}</div>

        <button onClick={onBack} style={{
          width: '100%', marginTop: 24, padding: 14, borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff',
          fontSize: 16, fontWeight: 700, fontFamily: 'Georgia,serif', letterSpacing: 1,
          cursor: 'pointer', boxShadow: '0 6px 20px #16a34a44',
        }}>{t.gotIt}</button>
      </div>
    </div>
  );
}
