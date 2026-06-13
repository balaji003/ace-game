export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VAL = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
export const IS_RED = s => s === '♥' || s === '♦';
export const NAMES = ['You', 'Alex', 'Sam', 'Jordan', 'Riya', 'Mei', 'Omar', 'Tara'];

