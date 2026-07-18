import { NAMES } from '../constants';

// Bird's-eye preview of seat positions shown in the Lobby.
// Props:
//   total    — total number of players including the human
//   username — logged-in username, shown under the "You" star seat
export default function TablePreview({ total, username }) {
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
        background: 'radial-gradient(ellipse,#16a34a,#15803d)',
        border: '2px solid #16a34a', boxShadow: 'inset 0 2px 14px #0006',
      }} />

      {/* Seat tokens */}
      {seats.map((s, i) => (
        <div key={i}>
          <div style={{
            position: 'absolute', left: s.x - 18, top: s.y - 18, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none',
            color: '#111', fontSize: s.me ? 26 : 15, fontWeight: 700, textAlign: 'center', lineHeight: 1,
            fontFamily: 'Verdana, sans-serif',
          }}>
            {s.me ? '♠' : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#002500" aria-hidden="true">
                <circle cx="12" cy="7" r="4.5" />
                <path d="M12 13c-4.4 0-8 2.6-8 6.5V21h16v-1.5c0-3.9-3.6-6.5-8-6.5z" />
              </svg>
            )}
          </div>
          {!s.me && (
            <div style={{
              position: 'absolute', left: s.x - 30, width: 60, top: s.y + 20, textAlign: 'center',
              fontSize: 10, fontWeight: 700, color: '#002500', fontFamily: 'Verdana, sans-serif',
            }}>
              {s.label}
            </div>
          )}
        </div>
      ))}

      {/* Your name, tucked under the "You" star seat */}
      {username && (
        <div style={{
          position: 'absolute', left: 0, width: size, top: cy + ry + 20, textAlign: 'center',
          fontSize: 11, fontWeight: 700, color: '#111', fontFamily: 'Verdana, sans-serif',
        }}>
          @{username}
        </div>
      )}
    </div>
  );
}
