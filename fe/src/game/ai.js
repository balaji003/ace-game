import { SUITS, RANKS, RANK_VAL } from '../constants';
import { legalMoves } from './engine';

export const cardStr = c => `${c.rank}${c.suit}`;

const lowest = arr => arr.reduce((b, c) => (RANK_VAL[c.rank] < RANK_VAL[b.rank] ? c : b));
const highest = arr => arr.reduce((b, c) => (RANK_VAL[c.rank] > RANK_VAL[b.rank] ? c : b));

// --- card memory -----------------------------------------------------------

// Every card this seat has seen this game: prior rounds (roundHistory), the
// current trick (roundCards), and its own hand. Used to reason about what's
// still outstanding in opponents' hands.
function seenKeys(game, me) {
  const set = new Set();
  const add = c => set.add(c.suit + c.rank);
  (game.roundHistory || []).forEach(p => add(p.card));
  (game.roundCards || []).forEach(p => add(p.card));
  (game.hands[me] || []).forEach(add);
  return set;
}

// Suits that NO opponent can hold any more — inferred purely from the cards.
// Every card is either in my hand, on the table this trick, gone to the discard
// (DEAD) pile, or in an opponent's hand. So if (mine + onTable + dead) accounts
// for all 13 of a suit, opponents hold none → they are all void in it. This is
// sound (no false positives): scooped cards stay counted as held by someone, so
// they never wrongly mark a suit exhausted.
function exhaustedSuits(game, me) {
  const out = new Set();
  for (const s of SUITS) {
    const mine = (game.hands[me] || []).filter(c => c.suit === s).length;
    const dead = (game.discard || []).filter(c => c.suit === s).length;
    const table = (game.roundCards || []).filter(p => p.card.suit === s).length;
    if (mine + dead + table >= 13) out.add(s);
  }
  return out;
}

// A player is void in a suit if they've cut it (engine-tracked) OR the cards
// prove no opponent can hold it (exhausted).
function isVoid(game, p, suit, exhausted) {
  return exhausted.has(suit) || !!game.suitVoids[p]?.includes(suit);
}

// Active opponents still in the round after me (could cut behind me).
function playersAfter(game) {
  return game.roundOrder.slice(game.turnIdx + 1);
}

function voidBehind(game, suit, exhausted) {
  return playersAfter(game).some(p => isVoid(game, p, suit, exhausted));
}

// Classify the outcome of leading `leadCard` of `suit`, using turn order +
// card memory. The first player after me who is void in the suit STOPS the
// round when they cut, so only the players between me and that cutter can play
// the suit. The pile then goes to whoever holds the highest suit card played.
//   'safe'  — no known cutter behind me this round.
//   'trap'  — a cutter is behind, but a non-void player acts before them who
//             could outrank my lead (a higher card is still outstanding) → the
//             cut likely lands on THEM, not me. Good.
//   'scoop' — the cutter acts before anyone who could outrank me, so I'd be
//             left holding the highest suit card → I take my own pile. Avoid.
function leadOutcome(game, me, suit, leadCard, seen, exhausted) {
  const after = playersAfter(game);
  const cutterAt = after.findIndex(p => isVoid(game, p, suit, exhausted));
  if (cutterAt === -1) return 'safe';

  const between = after.slice(0, cutterAt);     // act before the cut
  if (between.length === 0) return 'scoop';     // cutter is next → nobody outranks me

  const leadVal = RANK_VAL[leadCard.rank];
  const higherOutstanding = RANKS.some(r => RANK_VAL[r] > leadVal && !seen.has(suit + r));
  const canFollow = between.some(p => !isVoid(game, p, suit, exhausted));
  return higherOutstanding && canFollow ? 'trap' : 'scoop';
}

// --- strategic bot ---------------------------------------------------------

// Deterministic, fully-local opponent. Implements ACE strategy:
//  - Following: shed the highest card still BELOW the table's top card; never
//    become the top led-suit card when a cut is coming.
//  - Cutting: dump your most dangerous (highest) card — cutting is consequence
//    free for you, the led-suit high holder takes the pile.
//  - Leading: don't lead a suit where a cutter sits right behind you with nobody
//    to outrank your lead (you'd scoop your own pile); prefer a trap where a
//    higher-card holder acts before the cutter; otherwise shed low from a long
//    suit.
export function pickMove(game, playerIdx) {
  const d = decideMove(game, playerIdx);
  debugMove(game, playerIdx, d.valid, d.mode, d.card, d.exhausted);
  return d.card;
}

// Same decision as pickMove, but also returns the seat's reasoning in plain
// English. Powers Practice mode: the human is coached with the exact card the
// bot would play from their seat, and told why.
export function explainMove(game, playerIdx) {
  const d = decideMove(game, playerIdx);
  return { card: d.card, mode: d.mode, reason: d.reason };
}

// Core move decision shared by the bot (pickMove) and the coach (explainMove).
function decideMove(game, playerIdx) {
  const valid = legalMoves(game, playerIdx);
  const ledSuit = game.ledSuit;
  const exhausted = exhaustedSuits(game, playerIdx);

  let mode, card, reason;
  if (valid.length === 1) {
    mode = 'forced';
    card = valid[0];
    reason = `Only one legal card — you have to play ${cardStr(card)}.`;
  } else if (!ledSuit) {
    mode = 'lead';
    ({ card, reason } = chooseLead(game, playerIdx, valid, exhausted));
  } else if (valid.every(c => c.suit === ledSuit)) {
    mode = 'follow';
    ({ card, reason } = chooseFollow(game, valid, exhausted));
  } else {
    // Cutting: hold none of the led suit. Dump the biggest liability, preferring
    // a suit an opponent is already void in (keep suits I can still follow).
    mode = 'cut';
    ({ card, reason } = chooseCut(game, valid, exhausted));
  }

  return { mode, card, reason, valid, exhausted };
}

function chooseCut(game, valid, exhausted) {
  const led = game.ledSuit;
  const top = highest(valid);
  const dumpable = valid.filter(c => RANK_VAL[c.rank] === RANK_VAL[top.rank]);
  const voidCard = dumpable.find(c => voidBehind(game, c.suit, exhausted));
  const card = voidCard || top;

  let reason = `You have no ${led}, so you can cut. Throw your most dangerous card, ${cardStr(card)} — cutting costs you nothing; whoever holds the top ${led} on the table takes the whole pile.`;
  if (voidCard) reason += ` It's from a suit an opponent is already out of, so you keep the suits you can still follow.`;
  return { card, reason };
}

// Optional decision trace for verification. Inert in normal play; emits one
// structured console line per bot move when window.__ACE_DEBUG is set, exposing
// the bot's full (hidden) hand so a chosen move can be judged against what it
// actually held.
function debugMove(game, playerIdx, valid, mode, card, exhausted) {
  if (typeof window === 'undefined' || !window.__ACE_DEBUG) return;
  const N = ['You', 'Alex', 'Sam', 'Jordan', 'Riya', 'Mei', 'Omar', 'Tara'];
  const ck = c => c.rank + c.suit;
  console.log('[AI] ' + JSON.stringify({
    seat: N[playerIdx] ?? playerIdx,
    mode,
    led: game.ledSuit || '-',
    table: game.roundCards.map(p => (N[p.player] ?? p.player) + ':' + ck(p.card)),
    hand: game.hands[playerIdx].map(ck),
    valid: valid.map(ck),
    chose: ck(card),
    voids: (game.suitVoids || []).map((v, i) => v.length ? N[i] + ':' + v.join('') : null).filter(Boolean),
    exhausted: [...exhausted],
  }));
}

function chooseFollow(game, valid, exhausted) {
  const led = game.ledSuit;
  const onLed = game.roundCards.filter(p => p.card.suit === led);
  const maxPlayed = onLed.length ? Math.max(...onLed.map(p => RANK_VAL[p.card.rank])) : 0;
  const topCard = onLed.reduce((b, p) => (RANK_VAL[p.card.rank] > RANK_VAL[b.card.rank] ? p : b), onLed[0]);

  const safe = valid.filter(c => RANK_VAL[c.rank] < maxPlayed);
  if (safe.length) {                            // dump biggest non-winning card
    const card = highest(safe);
    return { card, reason: `Follow ${led}. ${cardStr(card)} is the biggest card you can play that still stays under ${cardStr(topCard.card)} on the table — you shed weight without winning the pile.` };
  }

  // Every playable card would top the pile.
  if (voidBehind(game, led, exhausted)) {       // cut coming → I'd take the pile, commit the least
    const card = lowest(valid);
    return { card, reason: `Every ${led} you hold would beat the table, and someone behind you is out of ${led} and can cut. You'll be stuck with the pile, so play your lowest, ${cardStr(card)}, to lose as little as possible.` };
  }
  const card = highest(valid);                  // safe to dump my biggest; I just lead next
  return { card, reason: `Every ${led} you hold would beat the table, but no cut is coming — the cards just go dead. Dump your highest, ${cardStr(card)}; you clear a big card and lead the next round.` };
}

function chooseLead(game, playerIdx, valid, exhausted) {
  const seen = seenKeys(game, playerIdx);
  const suits = [...new Set(valid.map(c => c.suit))];

  let best = null;
  for (const suit of suits) {
    const cards = valid.filter(c => c.suit === suit);
    const lead = lowest(cards);                 // lead low to stay safe and shed cheaply
    const outcome = leadOutcome(game, playerIdx, suit, lead, seen, exhausted);

    let score = 0;
    if (outcome === 'scoop') score -= 100;      // Rule 4: a cutter would leave me holding the pile → avoid
    else if (outcome === 'trap') score += 40;   // Rule 3: the cut lands on someone else → good
    score += cards.length * 2;                  // prefer shedding from / breaking up long suits
    score -= RANK_VAL[lead.rank] / 10;          // nudge toward the lower lead card

    if (!best || score > best.score) best = { card: lead, score, outcome, suit };
  }
  if (!best) {
    const card = lowest(valid);
    return { card, reason: `Lead your lowest card, ${cardStr(card)}, to shed cheaply.` };
  }

  const s = best.suit;
  let reason;
  if (best.outcome === 'trap')
    reason = `Lead low in ${s} with ${cardStr(best.card)}. A player who can beat it acts before the opponent who's out of ${s}, so the cut lands on them — not you.`;
  else if (best.outcome === 'scoop')
    reason = `No fully safe lead here. ${cardStr(best.card)} is the least-bad choice — a cut behind you could hand you your own pile, so keep the lead low.`;
  else
    reason = `Lead your lowest ${s}, ${cardStr(best.card)}. No one behind you is out of ${s} to cut it, so it's a safe, cheap shed.`;

  return { card: best.card, reason };
}
