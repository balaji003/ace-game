import { NAMES } from '../constants';

// Bird's-eye preview of seat positions shown in the Lobby.
// Props:
//   total — total number of players including the human
export default function TablePreview({ total }) {
  const size = 220, cx = size / 2, cy = size / 2;
  const rx = size * 0.40, ry = size * 0.34;
  const opponents = total - 1;

  const seats = [
    { x: cx, y: cy + ry, me: true, label: 'You' },
    ...Array.from({ length: opponents }, (_, i) => {
      const f = (i + 1) / (opponents + 1);
      const angle = Math.PI - f * Math.PI;
      return { x: cx + rx * Math.cos(angle), y: cy - ry * Math.sin(angle), me: false, label: NAMES[i + 1] };
    }),
  ];

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      {/* Felt oval */}
      <div style={{
        position: 'absolute',
        left: cx - rx - 6, top: cy - ry - 6,
        width: (rx + 6) * 2, height: (ry + 6) * 2,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse,#15803d,#0d4a2e)',
        border: '2px solid #16a34a55', boxShadow: 'inset 0 2px 14px #0006',
      }} />
      <div style={{ position: 'absolute', left: 0, top: cy - 9, width: size, textAlign: 'center', color: '#4ade8088', fontSize: 13, letterSpacing: 2 }}>
        ♠ ACE
      </div>

      {/* Seat tokens */}
      {seats.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: s.x - 18, top: s.y - 18, width: 36, height: 36,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: s.me ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
          border: s.me ? '2px solid #fff' : '1.5px solid #60a5fa',
          color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center', lineHeight: 1,
          boxShadow: '0 2px 8px #0005',
        }}>
          {s.me ? '★' : s.label.slice(0, 3)}
        </div>
      ))}
    </div>
  );
}
