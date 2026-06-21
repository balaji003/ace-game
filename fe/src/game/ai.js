import { NAMES, RANK_VAL } from '../constants';
import { api } from '../services/api';
import { legalMoves } from './engine';

export const cardStr = c => `${c.rank}${c.suit}`;

// Notified once per browser session when AI falls back to local bots
let sessionAINotified = false;
export const isAINotified = () => sessionAINotified;
export const markAINotified = () => { sessionAINotified = true; };

// Once the backend AI fails in a game, we stop calling it for the rest of that
// game and use the local bot — so a single failure doesn't hammer the API on
// every move. Reset at the start of each game via resetAI().
let aiDisabled = false;
export const isAIDisabled = () => aiDisabled;
export const resetAI = () => { aiDisabled = false; };

// Simple local bot: dumps high cards when a cutter is behind you, otherwise plays low
export function smartFallback(game, playerIdx, validCards) {
  const { ledSuit, roundOrder, turnIdx, suitVoids } = game;
  const playersAfter = roundOrder.slice(turnIdx + 1);
  const lowest = arr => arr.reduce((b, c) => RANK_VAL[c.rank] < RANK_VAL[b.rank] ? c : b);
  const highest = arr => arr.reduce((b, c) => RANK_VAL[c.rank] > RANK_VAL[b.rank] ? c : b);

  if (ledSuit) {
    const cutterComing = playersAfter.some(p => suitVoids[p]?.includes(ledSuit));
    return cutterComing ? highest(validCards) : lowest(validCards);
  }

  // Leading: pick the suit with the most cards in hand, play its lowest
  const counts = {};
  validCards.forEach(c => { counts[c.suit] = (counts[c.suit] || 0) + 1; });
  const bestSuit = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  return lowest(validCards.filter(c => c.suit === bestSuit));
}

// Ask the backend to pick a move. Falls back to smartFallback on any error,
// and after the first failure stays on the local bot for the rest of the game.
export async function askAI(game, playerIdx) {
  const validCards = legalMoves(game, playerIdx);

  // AI already failed this game → don't call the API again, just use the bot.
  if (aiDisabled) {
    return { card: smartFallback(game, playerIdx, validCards), usedAI: false, reason: 'ai disabled for game' };
  }

  const playersAfter = game.roundOrder.slice(game.turnIdx + 1);
  const payload = {
    player: NAMES[playerIdx],
    hand: game.hands[playerIdx].map(cardStr),
    ledSuit: game.ledSuit || '',
    validMoves: validCards.map(cardStr),
    roundCards: game.roundCards.map(rc => ({ player: NAMES[rc.player], card: cardStr(rc.card) })),
    playersAfter: playersAfter.map(p => NAMES[p]),
    voids: Object.fromEntries(
      NAMES.map((nm, i) => [nm, game.suitVoids[i] || []]).filter(e => e[1].length)
    ),
    counts: Object.fromEntries(
      NAMES.map((nm, i) => i < game.n ? [nm, game.hands[i].length] : null).filter(Boolean)
    ),
    recent: game.roundHistory.slice(-12).map(rc => `${NAMES[rc.player]}:${cardStr(rc.card)}`),
  };

  try {
    const data = await api.aiMove(payload);
    const idx = Number.isInteger(data.index) ? data.index : -1;
    if (idx >= 0 && idx < validCards.length) {
      return { card: validCards[idx], usedAI: true };
    }
    aiDisabled = true; // bad response → stop calling the API this game
    return { card: smartFallback(game, playerIdx, validCards), usedAI: false, reason: 'bad backend response' };
  } catch (e) {
    aiDisabled = true; // request failed → stop calling the API this game
    return { card: smartFallback(game, playerIdx, validCards), usedAI: false, reason: e.status ? `backend ${e.status}` : 'network error' };
  }
}
