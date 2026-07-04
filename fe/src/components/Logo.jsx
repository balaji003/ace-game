// The ACE brand mark: the four-aces cutout (transparent PNG — no box, floats on
// whatever background) optionally followed by the "ACE" wordmark. Used in every
// screen header.
//
// Props:
//   size      — image height in px (default 40); width scales with the artwork
//   fontSize  — wordmark size in px (default size * 0.5)
//   textColor — wordmark colour
//   showText  — render the "ACE" wordmark next to the mark (default true)
export default function Logo({ size = 40, fontSize, textColor = '#15803d', showText = true }) {
  const fs = fontSize ?? Math.round(size * 0.5);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.18) }}>
      <img
        src="/logo.png"
        alt="ACE"
        style={{
          height: size, width: 'auto', objectFit: 'contain', display: 'block',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
        }}
      />
      {showText && (
        <span style={{ fontSize: fs, fontWeight: 700, letterSpacing: 3, color: textColor }}>ACE</span>
      )}
    </div>
  );
}
