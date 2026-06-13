// Props:
//   tiny — smaller size (matches CardFace tiny sizing)
export default function CardBack({ tiny }) {
  const w = tiny ? 52 : 65;
  const h = tiny ? 72 : 92;

  return (
    <div style={{
      width: w, height: h, borderRadius: 8, flexShrink: 0,
      background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
      border: '1.5px solid #1e40af',
      boxShadow: '0 1px 3px #0003',
    }}>
      <div style={{
        margin: 4, height: 'calc(100% - 8px)', borderRadius: 4,
        border: '1px solid #60a5fa33',
        backgroundImage: 'repeating-linear-gradient(45deg,#60a5fa11 0,#60a5fa11 1px,transparent 0,transparent 50%)',
        backgroundSize: '6px 6px',
      }} />
    </div>
  );
}
