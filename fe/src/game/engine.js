import { NAMES } from '../constants';
import { deal, findStarter, highestOf, getRoundOrder } from '../utils/deck';

export function initGame(n = 4) {
  const hands = deal(n);
  const starter = findStarter(hands);
  return {
    hands,
    n,
    roundCards: [],
    ledSuit: null,
    leader: starter,
    roundOrder: getRoundOrder(starter, n, []),
    turnIdx: 0,
    finished: [],
    log: [`${NAMES[starter]} has A♠ — starts!`],
    phase: 'playing',       // 'playing' | 'result' | 'gameOver'
    suitVoids: Array.from({ length: n }, () => []),
    roundHistory: [],
    resultMsg: '',
    resultType: '',         // 'dead' | 'cut'
    nextLeader: null,
    pendingAI: false,
  };
}

// Called after the result pause — advances to the next round
export function resolveRound(state) {
  const { hands, n, finished, suitVoids, roundHistory, nextLeader } = state;
  const active = Array.from({ length: n }, (_, i) => i).filter(i => !finished.includes(i));

  if (active.length <= 1) {
    const loser = active.length === 1 ? active[0] : null;
    return {
      ...state,
      phase: 'gameOver',
      loser,
      roundCards: [],
      log: [...state.log, loser != null ? `🏴 ${NAMES[loser]} LOSES!` : ''],
    };
  }

  return {
    ...state,
    hands,
    roundCards: [],
    ledSuit: null,
    leader: nextLeader,
    roundOrder: getRoundOrder(nextLeader, n, finished),
    turnIdx: 0,
    phase: 'playing',
    suitVoids,
    roundHistory,
    resultMsg: '',
    resultType: '',
    nextLeader: null,
    pendingAI: false,
  };
}

// Returns the cards a player is allowed to play this turn
export function legalMoves(game, playerIdx) {
  const hand = game.hands[playerIdx];
  if (!game.ledSuit) return hand;
  const suited = hand.filter(c => c.suit === game.ledSuit);
  return suited.length ? suited : hand;
}

// Core state transition: player plays a card
export function applyPlay(state, playerIdx, card) {
  if (state.phase !== 'playing') return state;
  if (state.roundOrder[state.turnIdx] !== playerIdx) return state;

  const { roundCards, ledSuit, roundOrder, turnIdx, hands, finished, n, suitVoids, roundHistory } = state;

  // Block invalid moves (must follow suit if possible)
  if (ledSuit && card.suit !== ledSuit && hands[playerIdx].some(c => c.suit === ledSuit)) return state;

  const newLedSuit = ledSuit || card.suit;
  const newHands = hands.map((h, i) =>
    i === playerIdx ? h.filter(c => !(c.suit === card.suit && c.rank === card.rank)) : [...h]
  );
  const newRoundCards = [...roundCards, { player: playerIdx, card }];
  const newSuitVoids = suitVoids.map(v => [...v]);
  const newLog = [...state.log];

  const isCut = ledSuit !== null && card.suit !== ledSuit;
  if (isCut) {
    newSuitVoids[playerIdx] = [...new Set([...newSuitVoids[playerIdx], ledSuit])];
    newLog.push(`✂️ ${NAMES[playerIdx]} cuts with ${card.rank}${card.suit}!`);
  } else {
    newLog.push(`${NAMES[playerIdx]} plays ${card.rank}${card.suit}`);
  }

  let newFinished = [...finished];
  if (newHands[playerIdx].length === 0 && !newFinished.includes(playerIdx)) {
    newFinished.push(playerIdx);
    newLog.push(`🎉 ${NAMES[playerIdx]} finished! (#${newFinished.length})`);
  }

  const isLastInRound = turnIdx === roundOrder.length - 1;

  // Mid-round: just advance to the next player
  if (!isCut && !isLastInRound) {
    const nextTurnIdx = turnIdx + 1;
    const nextPlayer = roundOrder[nextTurnIdx];
    return {
      ...state,
      hands: newHands,
      roundCards: newRoundCards,
      ledSuit: newLedSuit,
      turnIdx: nextTurnIdx,
      finished: newFinished,
      log: newLog,
      suitVoids: newSuitVoids,
      pendingAI: nextPlayer !== 0,
    };
  }

  // Round ends (cut OR everyone has played)
  const highest = highestOf(newRoundCards, newLedSuit);
  let rHands = newHands.map(h => [...h]);
  let rFinished = [...newFinished];
  let rLeader, resultMsg, resultType;

  if (isCut) {
    const taker = highest.player;
    const takenCards = newRoundCards.map(rc => rc.card);
    rHands[taker] = [...rHands[taker], ...takenCards];
    rFinished = rFinished.filter(p => p !== taker);
    rLeader = taker;
    resultMsg = `✂️ CUT! ${NAMES[taker]} held ${highest.card.rank}${highest.card.suit} — takes ${takenCards.length} cards!`;
    resultType = 'cut';
    newLog.push(resultMsg);
  } else {
    rLeader = highest.player;
    resultMsg = `💀 Cards go DEAD. ${NAMES[rLeader]} leads next round.`;
    resultType = 'dead';
    newLog.push(resultMsg);
  }

  const newRoundHistory = [...roundHistory, ...newRoundCards];
  const active = Array.from({ length: n }, (_, i) => i).filter(i => !rFinished.includes(i));

  // Game might be over — still show result first, then transition to gameOver
  const loser = active.length <= 1 ? (active.length === 1 ? active[0] : null) : undefined;
  if (loser !== undefined && loser != null) newLog.push(`🏴 ${NAMES[loser]} LOSES!`);

  return {
    ...state,
    hands: rHands,
    roundCards: newRoundCards,   // keep visible during result phase
    ledSuit: newLedSuit,
    finished: rFinished,
    log: newLog,
    suitVoids: newSuitVoids,
    roundHistory: newRoundHistory,
    phase: 'result',
    resultMsg,
    resultType,
    nextLeader: rLeader,
    pendingAI: false,
    ...(loser !== undefined ? { loser } : {}),
  };
}
