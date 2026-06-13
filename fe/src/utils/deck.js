import { SUITS, RANKS, RANK_VAL } from '../constants';

export function shuffle(arr) {
  const b = [...arr];
  for (let i = b.length - 1; i > 0; i--) {
    const j = 0 | (Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function deal(n) {
  const deck = shuffle(SUITS.flatMap(s => RANKS.map(r => ({ suit: s, rank: r }))));
  const hands = Array.from({ length: n }, () => []);
  deck.forEach((c, i) => hands[i % n].push(c));
  return hands;
}

// Returns the index of whoever holds A♠ (they go first)
export function findStarter(hands) {
  return hands.findIndex(h => h.some(c => c.suit === '♠' && c.rank === 'A'));
}

// Returns the played-card entry with the highest rank in the given suit
export function highestOf(played, suit) {
  return played
    .filter(p => p.card.suit === suit)
    .reduce((best, p) =>
      !best || RANK_VAL[p.card.rank] > RANK_VAL[best.card.rank] ? p : best,
      null
    );
}

// Players who haven't finished yet, in play order starting from leader
export function getRoundOrder(leader, n, finished) {
  return Array.from({ length: n }, (_, i) => (leader + i) % n).filter(p => !finished.includes(p));
}
