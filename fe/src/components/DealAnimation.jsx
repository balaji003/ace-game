import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BOARD_BG_GREEN, PAGE_BG_BLUE } from '../theme';
import { sounds } from '../native/sound';

// Start-of-game dealing animation (offline + online). A deck sits in the centre
// and cards are flung out to every seat, like a dealer machine, then it fades
// and calls onDone so the real board (hands) is revealed. Purely cosmetic — it
// deals a few visual passes, not the real 52 cards.
//
// Props:
//   n      — total players (seat 0 = you, seated bottom-centre)
//   theme  — 'green' (offline) | 'blue' (online)
//   onDone — called once, when the animation finishes
export default function DealAnimation({ n = 4, theme = 'green', onDone }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 360, h: 640 });

  // Measure before paint so the very first frame already has correct targets.
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Shuffle + deal sound, once, in step with the animation.
  useEffect(() => { sounds.deal(); }, []);

  const blue = theme === 'blue';
  const bg = blue ? PAGE_BG_BLUE : BOARD_BG_GREEN;
  const backBg = blue
    ? 'linear-gradient(135deg,#1e3a8a,#1d4ed8)'
    : 'linear-gradient(135deg,#166534,#15803d)';
  const backBorder = blue ? '#1e40af' : '#14532d';
  const pattern = blue
    ? 'repeating-linear-gradient(45deg,#60a5fa11 0,#60a5fa11 1px,transparent 0,transparent 50%)'
    : 'repeating-linear-gradient(45deg,#4ade8022 0,#4ade8022 1px,transparent 0,transparent 50%)';
  const patternBorder = blue ? '#60a5fa33' : '#4ade8033';

  const CW = 40, CH = 56;
  const DECK = 52;

  // Seat target offsets from the centre (px): you sit low-centre; opponents
  // spread along an arc across the upper half.
  const seats = useMemo(() => {
    const { w, h } = size;
    const opp = n - 1;
    const arr = [{ dx: 0, dy: h * 0.30, rot: 0 }]; // you
    const rx = Math.min(w * 0.38, 210), ry = h * 0.22;
    for (let i = 0; i < opp; i++) {
      const f = (i + 1) / (opp + 1);
      const angle = Math.PI - f * Math.PI; // left → right across the top
      arr.push({
        dx: rx * Math.cos(angle),
        dy: -h * 0.14 - ry * Math.sin(angle),
        rot: Math.cos(angle) * 16,
      });
    }
    return arr;
  }, [size, n]);

  // A quick shuffle of the deck plays first, then the deal begins.
  const SHUFFLE_MS = 650;

  // Deal the whole 52-card deck, one card to the next seat round-robin, each
  // landing on a slightly offset spot so a pile visibly grows at every seat.
  const stepMs = Math.min(46, Math.max(24, Math.round(1550 / DECK)));
  const flights = useMemo(() => {
    const list = [];
    const pile = new Array(n).fill(0);
    for (let k = 0; k < DECK; k++) {
      const s = k % n;
      const p = pile[s]++;
      const seat = seats[s];
      list.push({
        key: k,
        dx: seat.dx + (p % 6) * 2 - 5,
        dy: seat.dy + Math.floor(p / 6) * 3,
        rot: seat.rot + (p % 3 - 1) * 4,
        delay: SHUFFLE_MS + k * stepMs,
      });
    }
    return list;
  }, [seats, n, stepMs]);

  // Fire onDone once, after the last card lands. Timer keyed on the numeric
  // total so parent re-renders (new onDone identity) don't restart it.
  const total = Math.round(SHUFFLE_MS + (DECK - 1) * stepMs + 480 + 260);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useLayoutEffect(() => {
    const t = setTimeout(() => onDoneRef.current?.(), total);
    return () => clearTimeout(t);
  }, [total]);

  return (
    <div ref={ref} style={{
      position: 'fixed', inset: 0, zIndex: 40, overflow: 'hidden', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: `dealFadeOut 0.35s ease ${total - 350}ms forwards`,
    }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%' }}>
        {/* Deck stack — riffles during the shuffle lead-in */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={`d${i}`} style={{
            position: 'absolute', width: CW, height: CH,
            left: -CW / 2 + i * 0.6, top: -CH / 2 - i * 0.9,
            borderRadius: 6, background: backBg, border: `1.5px solid ${backBorder}`,
            boxShadow: '0 2px 7px #0004',
            animation: `dealShuffle 0.26s ease ${i * 35}ms 2 alternate`,
          }} />
        ))}

        {/* Cards flying to seats */}
        {flights.map(f => (
          <div key={f.key} style={{
            position: 'absolute', width: CW, height: CH, left: -CW / 2, top: -CH / 2,
            borderRadius: 6, background: backBg, border: `1.5px solid ${backBorder}`,
            boxShadow: '0 4px 12px #0005', opacity: 0,
            animation: `dealFly 0.42s cubic-bezier(.3,.7,.25,1) ${f.delay}ms forwards`,
            '--tx': `${f.dx}px`,
            '--ty': `${f.dy}px`,
            '--rot': `${f.rot}deg`,
          }}>
            <div style={{
              margin: 3, height: 'calc(100% - 6px)', borderRadius: 3,
              border: `1px solid ${patternBorder}`, backgroundImage: pattern, backgroundSize: '5px 5px',
            }} />
          </div>
        ))}
      </div>

      <div style={{
        position: 'absolute', bottom: '16%', left: 0, right: 0, textAlign: 'center',
        fontFamily: 'Verdana, sans-serif', letterSpacing: 4, fontWeight: 700, fontSize: 14,
        color: blue ? '#7dd3fc' : '#15803d', animation: 'dealPulse 1s ease infinite',
      }}>DEALING…</div>

      <style>{`
        @keyframes dealFly {
          0%   { opacity: 0; transform: translate(0,0) rotate(0) scale(.72); }
          14%  { opacity: 1; }
          100% { opacity: 1; transform: translate(var(--tx),var(--ty)) rotate(var(--rot)) scale(1); }
        }
        @keyframes dealShuffle {
          0%   { transform: translate(0,0) rotate(0); }
          100% { transform: translate(9px,-2px) rotate(4deg); }
        }
        @keyframes dealPulse { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes dealFadeOut { to { opacity: 0; } }
      `}</style>
    </div>
  );
}
