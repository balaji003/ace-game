// Shared page backgrounds. Layered so screens don't look flat: a faint dot
// texture on top, a few soft light blobs that fade out, then the base gradient.
// Drop the string straight into an inline style's `background`.

export const PAGE_BG_GREEN = [
  'radial-gradient(#15803d12 1.4px, transparent 1.6px) 0 0 / 26px 26px',
  'radial-gradient(circle at 16% 12%, #ffffffaa, transparent 40%)',
  'radial-gradient(circle at 86% 6%, #bbf7d0, transparent 44%)',
  'radial-gradient(ellipse at 50% 120%, #4ade8055, transparent 62%)',
  'radial-gradient(ellipse at 50% 30%, #c9f7d6, #dcfce7 80%)',
].join(',');

// Slightly greener variant for the play surface (game board).
export const BOARD_BG_GREEN = [
  'radial-gradient(#15803d1a 1.4px, transparent 1.6px) 0 0 / 26px 26px',
  'radial-gradient(circle at 16% 10%, #ffffff99, transparent 38%)',
  'radial-gradient(ellipse at 50% 125%, #22c55e66, transparent 60%)',
  'radial-gradient(ellipse at 50% 38%, #bbf7d0, #86efac)',
].join(',');

export const PAGE_BG_BLUE = [
  'radial-gradient(#0ea5e91f 1.4px, transparent 1.6px) 0 0 / 26px 26px',
  'radial-gradient(circle at 16% 12%, #0ea5e933, transparent 42%)',
  'radial-gradient(circle at 86% 6%, #38bdf833, transparent 44%)',
  'radial-gradient(ellipse at 50% 120%, #0ea5e94d, transparent 62%)',
  'radial-gradient(ellipse at 50% 40%, #0c4a6e, #04293d)',
].join(',');
