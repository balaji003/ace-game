import { useState, useEffect, useRef } from "react";

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VAL = Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));
const IS_RED = s => s==='♥'||s==='♦';
const NAMES = ['You','Alex','Sam','Jordan','Riya','Mei','Omar','Tara'];

const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=0|Math.random()*(i+1);[b[i],b[j]]=[b[j],b[i]];} return b; };
const deal = n => { const deck=shuffle(SUITS.flatMap(s=>RANKS.map(r=>({suit:s,rank:r})))); const h=Array.from({length:n},()=>[]); deck.forEach((c,i)=>h[i%n].push(c)); return h; };
const findStarter = hands => hands.findIndex(h=>h.some(c=>c.suit==='♠'&&c.rank==='A'));
const highestOf = (played, suit) => played.filter(p=>p.card.suit===suit).reduce((b,p)=>!b||RANK_VAL[p.card.rank]>RANK_VAL[b.card.rank]?p:b, null);
const getRoundOrder = (leader, n, finished) => Array.from({length:n},(_,i)=>(leader+i)%n).filter(p=>!finished.includes(p));

function initGame(n=4) {
  const hands = deal(n);
  const starter = findStarter(hands);
  return {
    hands, n,
    roundCards: [],
    ledSuit: null,
    leader: starter,
    roundOrder: getRoundOrder(starter, n, []),
    turnIdx: 0,
    finished: [],
    log: [`${NAMES[starter]} has A♠ — starts!`],
    phase: 'playing',   // 'playing' | 'result' | 'gameOver'
    suitVoids: Array.from({length:n},()=>[]),
    roundHistory: [],
    resultMsg: '',
    resultType: '',     // 'dead' | 'cut'
    nextLeader: null,
    pendingAI: false,   // flag to trigger AI
  };
}

// Just advances the round after showing result
function resolveRound(state) {
  const { hands, n, finished, suitVoids, roundHistory, roundCards, nextLeader, ledSuit } = state;
  const rLeader = nextLeader;
  const active = Array.from({length:n},(_,i)=>i).filter(i=>!finished.includes(i));
  if (active.length <= 1) {
    const loser = active.length===1 ? active[0] : null;
    return { ...state, phase:'gameOver', loser, roundCards:[], log:[...state.log, loser!=null?`🏴 ${NAMES[loser]} LOSES!`:''] };
  }
  return { ...state,
    hands, roundCards:[], ledSuit:null,
    leader:rLeader,
    roundOrder: getRoundOrder(rLeader, n, finished),
    turnIdx:0, phase:'playing',
    suitVoids, roundHistory,
    resultMsg:'', resultType:'', nextLeader:null,
    pendingAI: false,
  };
}

function applyPlay(state, playerIdx, card) {
  if (state.phase !== 'playing') return state;
  if (state.roundOrder[state.turnIdx] !== playerIdx) return state;

  const { roundCards, ledSuit, roundOrder, turnIdx, hands, finished, n, suitVoids, roundHistory } = state;

  if (ledSuit && card.suit !== ledSuit && hands[playerIdx].some(c=>c.suit===ledSuit)) return state;

  const newLedSuit = ledSuit || card.suit;
  const newHands = hands.map((h,i) => i===playerIdx ? h.filter(c=>!(c.suit===card.suit&&c.rank===card.rank)) : [...h]);
  const newRoundCards = [...roundCards, {player:playerIdx, card}];
  const newSuitVoids = suitVoids.map(v=>[...v]);
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
  // Not end of round yet — just next player's turn
  if (!isCut && !isLastInRound) {
    const nextTurnIdx = turnIdx + 1;
    const nextPlayer = roundOrder[nextTurnIdx];
    return { ...state, hands:newHands, roundCards:newRoundCards, ledSuit:newLedSuit,
      turnIdx:nextTurnIdx, finished:newFinished, log:newLog, suitVoids:newSuitVoids,
      pendingAI: nextPlayer !== 0 };
  }

  // ── Round ends (cut or last player) ──
  const highest = highestOf(newRoundCards, newLedSuit);
  let rHands = newHands.map(h=>[...h]);
  let rFinished = [...newFinished];
  let rLeader;
  let resultMsg, resultType;

  if (isCut) {
    const taker = highest.player;
    const takenCards = newRoundCards.map(rc=>rc.card);
    rHands[taker] = [...rHands[taker], ...takenCards];
    rFinished = rFinished.filter(p=>p!==taker);
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

  const active = Array.from({length:n},(_,i)=>i).filter(i=>!rFinished.includes(i));
  if (active.length <= 1) {
    const loser = active.length===1 ? active[0] : null;
    if (loser!=null) newLog.push(`🏴 ${NAMES[loser]} LOSES!`);
    // Still show result first before gameOver
    return { ...state, hands:rHands, finished:rFinished, log:newLog,
      roundCards:newRoundCards,  // keep for display!
      suitVoids:newSuitVoids, roundHistory:newRoundHistory,
      phase:'result', resultMsg, resultType,
      nextLeader:rLeader, ledSuit:newLedSuit,
      pendingAI:false,
      loser,
    };
  }

  // Show result phase — keep cards visible
  return { ...state, hands:rHands,
    roundCards:newRoundCards,   // keep visible!
    ledSuit:newLedSuit,
    finished:rFinished, log:newLog, suitVoids:newSuitVoids,
    roundHistory:newRoundHistory,
    phase:'result', resultMsg, resultType,
    nextLeader:rLeader,
    pendingAI:false,
  };
}

// ── AI move via backend ───────────────────────────────────────────────────────
// CONFIG: master switch for AI opponents. When false, AI is never used and the
// lobby shows no AI option at all (every game uses local quick bots).
const AI_ENABLED = true;

// Set to true once we've told the user (this session) that AI fell back.
let SESSION_AI_NOTIFIED = false;

// Set this to your deployed Go backend, e.g. "https://api.yourdomain.com".
// Leave empty to skip the network call (AI will fall back to local bots).
const API_BASE = "";

const cardStr = c => `${c.rank}${c.suit}`;

// Legal moves for a player given the current led suit.
function legalMoves(g, playerIdx) {
  const hand = g.hands[playerIdx];
  if (!g.ledSuit) return hand;
  const suited = hand.filter(c => c.suit === g.ledSuit);
  return suited.length ? suited : hand;
}

// Ask the backend to choose a move. Returns { card, usedAI, reason }.
async function askAI(g, playerIdx) {
  const validCards = legalMoves(g, playerIdx);

  if (!API_BASE) {
    return { card: smartFallback(g, playerIdx, validCards), usedAI:false, reason:'no backend configured' };
  }

  const playersAfter = g.roundOrder.slice(g.turnIdx + 1);
  const payload = {
    player: NAMES[playerIdx],
    hand: g.hands[playerIdx].map(cardStr),
    ledSuit: g.ledSuit || "",
    validMoves: validCards.map(cardStr),
    roundCards: g.roundCards.map(rc => ({ player: NAMES[rc.player], card: cardStr(rc.card) })),
    playersAfter: playersAfter.map(p => NAMES[p]),
    voids: Object.fromEntries(NAMES.map((nm,i)=>[nm, g.suitVoids[i]||[]]).filter(e=>e[1].length)),
    counts: Object.fromEntries(NAMES.map((nm,i)=>i<g.n?[nm, g.hands[i].length]:null).filter(Boolean)),
    recent: g.roundHistory.slice(-12).map(rc => `${NAMES[rc.player]}:${cardStr(rc.card)}`),
  };

  try {
    const res = await fetch(`${API_BASE}/api/ai/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[ACE] BE AI error:", res.status);
      return { card: smartFallback(g, playerIdx, validCards), usedAI:false, reason:`backend ${res.status}` };
    }
    const data = await res.json();
    const idx = Number.isInteger(data.index) ? data.index : -1;
    if (idx >= 0 && idx < validCards.length) {
      return { card: validCards[idx], usedAI:true };
    }
    return { card: smartFallback(g, playerIdx, validCards), usedAI:false, reason:'bad backend response' };
  } catch (e) {
    console.error("[ACE] BE AI fetch error:", e);
    return { card: smartFallback(g, playerIdx, validCards), usedAI:false, reason:'network error' };
  }
}

function smartFallback(g, playerIdx, validCards) {
  const ledSuit = g.ledSuit;
  const playersAfter = g.roundOrder.slice(g.turnIdx + 1);
  const low = arr => arr.reduce((b,c)=>RANK_VAL[c.rank]<RANK_VAL[b.rank]?c:b);
  const high = arr => arr.reduce((b,c)=>RANK_VAL[c.rank]>RANK_VAL[b.rank]?c:b);
  if (ledSuit) {
    const cutterComing = playersAfter.some(p=>g.suitVoids[p]?.includes(ledSuit));
    return cutterComing ? high(validCards) : low(validCards);
  }
  const counts = {};
  validCards.forEach(c=>{counts[c.suit]=(counts[c.suit]||0)+1;});
  const bestSuit = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  return low(validCards.filter(c=>c.suit===bestSuit));
}

// ── Card UI ───────────────────────────────────────────────────────────────────
function CardFace({ card, onClick, glow, dim, tiny, highlight }) {
  const red = IS_RED(card.suit);
  const w=tiny?52:65, h=tiny?72:92;
  return (
    <div onClick={onClick} style={{ width:w, height:h, borderRadius:8, flexShrink:0,
      background:glow?'#fffbeb':highlight?'#fff7ed':'linear-gradient(160deg,#fff 70%,#f8fafc)',
      border:glow?'2.5px solid #f59e0b':highlight?'2px solid #f97316':'1.5px solid #cbd5e1',
      boxShadow:glow?'0 0 14px #fbbf2488':highlight?'0 0 10px #f9731666':'0 1px 4px #0001',
      cursor:onClick?'pointer':'default', position:'relative',
      opacity:dim?0.35:1, transition:'all 0.15s', userSelect:'none' }}>
      <div style={{position:'absolute',top:2,left:4,fontSize:tiny?10:12,fontWeight:700,lineHeight:1.2,color:red?'#dc2626':'#111',fontFamily:'Georgia,serif'}}>{card.rank}<br/>{card.suit}</div>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:tiny?20:26,color:red?'#dc2626':'#111',fontFamily:'Georgia,serif'}}>{card.suit}</div>
      <div style={{position:'absolute',bottom:2,right:4,fontSize:tiny?10:12,fontWeight:700,lineHeight:1.2,color:red?'#dc2626':'#111',transform:'rotate(180deg)',fontFamily:'Georgia,serif'}}>{card.rank}<br/>{card.suit}</div>
    </div>
  );
}
function CardBack({ tiny }) {
  const w=tiny?52:65, h=tiny?72:92;
  return (
    <div style={{width:w,height:h,borderRadius:8,flexShrink:0,background:'linear-gradient(135deg,#1e3a8a,#1d4ed8)',border:'1.5px solid #1e40af',boxShadow:'0 1px 3px #0003'}}>
      <div style={{margin:4,height:'calc(100% - 8px)',borderRadius:4,border:'1px solid #60a5fa33',backgroundImage:'repeating-linear-gradient(45deg,#60a5fa11 0,#60a5fa11 1px,transparent 0,transparent 50%)',backgroundSize:'6px 6px'}}/>
    </div>
  );
}

// ── Fanned Hand ───────────────────────────────────────────────────────────────
function FannedHand({ cards, validSet, isMyTurn, onPlay, phase }) {
  const [hovered, setHovered] = useState(null);
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(500);

  // Measure container width so the fan always fits, no scroll
  useEffect(() => {
    const measure = () => {
      if (wrapRef.current) setWrapW(wrapRef.current.offsetWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const n = cards.length;
  if (n === 0) return (
    <div style={{height:140,display:'flex',alignItems:'center',justifyContent:'center',color:'#4ade8055',fontSize:13}}>
      No cards — waiting…
    </div>
  );

  const W = 56, H = 80;
  const containerH = 150;
  const pivotY = containerH + 220;       // arc pivot far below for gentle curve
  const sidePad = 14;                     // breathing room at edges
  const avail = Math.max(wrapW - sidePad * 2, W);

  // Step between card centers so all n cards span exactly `avail`.
  // Cap step at a comfortable spacing when few cards; shrink to fit when many.
  const maxStep = W - 14;                 // nice spacing when hand is small
  const step = n > 1 ? Math.min(maxStep, (avail - W) / (n - 1)) : 0;
  const usedWidth = W + step * (n - 1);

  // Fan angle: gentle, scales down as cards pack tighter
  const maxAngle = Math.min(2.2 * n, 46);
  const angleStep = n > 1 ? maxAngle / (n - 1) : 0;
  const startAngle = -maxAngle / 2;

  // How readable is each card's face? When packed tight only a sliver shows,
  // so anchor the rank/suit to the visible left strip.
  const tight = step < 22;

  return (
    <div ref={wrapRef} style={{position:'relative', width:'100%', height:containerH, userSelect:'none'}}>
      <div style={{position:'absolute', left:'50%', transform:'translateX(-50%)', width: usedWidth, height: containerH}}>
        {cards.map((card, i) => {
          const key = card.suit + card.rank;
          const valid = validSet.has(key);
          const isHov = hovered === key;
          const angle = startAngle + i * angleStep;
          const cx = i * step + W/2;
          const cy = H/2 + 28;
          const liftY = isHov ? -26 : (valid && isMyTurn) ? -11 : 0;
          const red = IS_RED(card.suit);

          return (
            <div
              key={key}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => valid && isMyTurn && onPlay(card)}
              style={{
                position:'absolute',
                left: cx - W/2,
                top: cy - H/2,
                width: W, height: H,
                transform: `rotate(${angle}deg) translateY(${liftY}px)`,
                transformOrigin: `${W/2}px ${pivotY}px`,
                transition: 'transform 0.18s ease, box-shadow 0.15s',
                cursor: (valid && isMyTurn) ? 'pointer' : 'default',
                zIndex: isHov ? 1000 : i,
                borderRadius: 7,
                background: valid && isMyTurn
                  ? (isHov ? '#fffbeb' : '#fff')
                  : 'linear-gradient(160deg,#fff 72%,#f1f5f9)',
                border: isHov && valid && isMyTurn
                  ? '2.5px solid #f59e0b'
                  : valid && isMyTurn ? '2px solid #fcd34d' : '1px solid #cbd5e1',
                boxShadow: isHov
                  ? '0 10px 26px #0006, 0 0 18px #fbbf2466'
                  : valid && isMyTurn ? '0 4px 12px #0003' : '0 2px 7px #0002',
                opacity: (isMyTurn && !valid) ? 0.45 : 1,
                overflow:'hidden',
              }}
            >
              {/* Top-left index always visible even when packed tight */}
              <div style={{position:'absolute',top:3,left:4,fontSize:11,fontWeight:700,lineHeight:1.15,color:red?'#dc2626':'#111',fontFamily:'Georgia,serif'}}>
                {card.rank}<br/>{card.suit}
              </div>
              {/* Center pip + bottom index only when there's room */}
              {!tight && (
                <>
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:21,color:red?'#dc2626':'#111',fontFamily:'Georgia,serif'}}>{card.suit}</div>
                  <div style={{position:'absolute',bottom:3,right:4,fontSize:11,fontWeight:700,lineHeight:1.15,color:red?'#dc2626':'#111',transform:'rotate(180deg)',fontFamily:'Georgia,serif'}}>{card.rank}<br/>{card.suit}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {/* count badge */}
      <div style={{position:'absolute',bottom:2,right:6,fontSize:10,color:'#86efac99'}}>{n} cards</div>
    </div>
  );
}

// ── Result Graphic Overlay ────────────────────────────────────────────────────
function ResultGraphic({ type, cards, takerName, count }) {
  // type: 'dead' = cards burn/vanish ; 'cut' = cards swept to a player
  const mini = (card, i, style) => {
    const red = IS_RED(card.suit);
    return (
      <div key={i} style={{
        position:'absolute', width:46, height:64, borderRadius:6,
        background:'linear-gradient(160deg,#fff 70%,#f1f5f9)',
        border:'1.5px solid #cbd5e1', boxShadow:'0 3px 10px #0004',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'Georgia,serif', fontWeight:700,
        ...style,
      }}>
        <span style={{position:'absolute',top:2,left:4,fontSize:10,color:red?'#dc2626':'#111'}}>{card.rank}{card.suit}</span>
        <span style={{fontSize:20,color:red?'#dc2626':'#111'}}>{card.suit}</span>
      </div>
    );
  };

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:500,
      display:'flex', alignItems:'center', justifyContent:'center',
      pointerEvents:'none', overflow:'hidden',
    }}>
      {/* backdrop flash */}
      <div style={{
        position:'absolute', inset:0,
        background: type==='cut'
          ? 'radial-gradient(circle, #7f1d1d55 0%, transparent 70%)'
          : 'radial-gradient(circle, #1e1b4b66 0%, transparent 70%)',
        animation:'flashBg 0.5s ease-out',
      }}/>

      {/* the cards animating */}
      <div style={{position:'relative', width:0, height:0}}>
        {cards.map((rc, i) => {
          const card = rc.card || rc;
          const spread = (i - (cards.length-1)/2);
          if (type === 'dead') {
            // fly up + fade + spin (burn away)
            return mini(card, i, {
              left: spread*30 - 23,
              top: -32,
              animation:`flyDead 1.6s cubic-bezier(.4,0,.6,1) forwards`,
              animationDelay:`${i*0.06}s`,
              '--dx': `${spread*40}px`,
              '--rot': `${spread*40}deg`,
            });
          }
          // cut: cards collapse into a stack then shoot toward taker (down)
          return mini(card, i, {
            left: spread*30 - 23,
            top: -32,
            animation:`flySwept 1.6s cubic-bezier(.5,0,.7,1) forwards`,
            animationDelay:`${i*0.05}s`,
            '--dx': `${-spread*30}px`,
          });
        })}
      </div>

      {/* central emblem */}
      <div style={{
        position:'absolute',
        display:'flex', flexDirection:'column', alignItems:'center', gap:4,
        animation:'popEmblem 0.5s cubic-bezier(.2,1.4,.5,1) 0.3s both',
      }}>
        <div style={{fontSize:46, filter:'drop-shadow(0 2px 8px #0008)'}}>
          {type==='cut' ? '✂️' : '💀'}
        </div>
        <div style={{
          background: type==='cut' ? 'linear-gradient(135deg,#dc2626,#7f1d1d)' : 'linear-gradient(135deg,#4338ca,#1e1b4b)',
          border:`2px solid ${type==='cut'?'#fca5a5':'#a5b4fc'}`,
          borderRadius:10, padding:'7px 16px',
          fontSize:14, fontWeight:700, color:'#fff', textAlign:'center',
          boxShadow:'0 6px 20px #0006', whiteSpace:'nowrap', fontFamily:'Georgia,serif',
        }}>
          {type==='cut'
            ? `${takerName} takes ${count} cards!`
            : `${count} cards burned!`}
        </div>
      </div>

      {/* particles for dead = embers, cut = sweep lines */}
      {type==='dead' && Array.from({length:10}).map((_,i)=>(
        <div key={i} style={{
          position:'absolute', width:5, height:5, borderRadius:'50%',
          background: ['#f59e0b','#ef4444','#fbbf24'][i%3],
          left:'50%', top:'50%',
          animation:`ember 1.4s ease-out forwards`,
          animationDelay:`${0.2 + i*0.05}s`,
          '--ex': `${(Math.random()-0.5)*180}px`,
          '--ey': `${-60 - Math.random()*80}px`,
        }}/>
      ))}
    </div>
  );
}

// ── Arena: dynamic seating around the table ───────────────────────────────────
function OppChip({ idx, game, cur, aiStatus, style }) {
  const h = game.hands[idx];
  const active = cur === idx;
  const done = game.finished.includes(idx);
  const thinking = !!aiStatus && active;
  const show = Math.min(h.length, 6);
  return (
    <div style={{
      position:'absolute', transform:'translate(-50%,-50%)',
      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
      width:60, ...style,
    }}>
      <div style={{
        fontSize:10, fontWeight:700,
        color: active?'#fde68a':done?'#4ade80':'#cbe6d6',
        background: active?'#fef3c722':'transparent',
        padding:'1px 6px', borderRadius:6, whiteSpace:'nowrap',
      }}>
        {NAMES[idx]} {done?'✅':active?(thinking?'🤖':'🎯'):''}
      </div>
      <div style={{position:'relative', height:54, width:46}}>
        {h.length===0
          ? <div style={{width:42,height:54,borderRadius:6,border:'1px dashed #166534',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,position:'absolute',left:2}}>✅</div>
          : Array.from({length:show}).map((_,i)=>(
              <div key={i} style={{position:'absolute', left:i*3, top:i*1.5}}>
                <div style={{width:40,height:54,borderRadius:6,
                  background:'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
                  border:'1.5px solid #1e40af', boxShadow:'0 1px 3px #0004'}}>
                  <div style={{margin:3,height:'calc(100% - 6px)',borderRadius:3,border:'1px solid #60a5fa33',
                    backgroundImage:'repeating-linear-gradient(45deg,#60a5fa11 0,#60a5fa11 1px,transparent 0,transparent 50%)',
                    backgroundSize:'5px 5px'}}/>
                </div>
              </div>
            ))
        }
      </div>
      <div style={{
        fontSize:10, color: active?'#fde68a':'#86efac',
        background:'#06281aaa', padding:'1px 7px', borderRadius:8, fontWeight:700,
      }}>{h.length}</div>
    </div>
  );
}

function Arena({ game, cur, aiStatus, highestCard }) {
  const n = game.n;
  const m = n - 1; // opponents
  const H = m >= 6 ? 320 : m >= 5 ? 300 : 280;
  const arcCenterY = 118;
  const arcRy = m >= 5 ? 96 : 86;

  const seats = [];
  for (let i = 0; i < m; i++) {
    const idx = i + 1;
    const f = (i + 1) / (m + 1);
    const angle = Math.PI - f * Math.PI; // left → top → right
    const leftPct = 50 + 42 * Math.cos(angle);
    const top = arcCenterY - arcRy * Math.sin(angle);
    seats.push({ idx, leftPct, top });
  }

  const borderColor = game.phase==='result'
    ? (game.resultType==='cut' ? '#f97316aa' : '#6366f1aa')
    : '#16a34a44';

  return (
    <div style={{position:'relative', width:'100%', height:H,
      background:'radial-gradient(ellipse at 50% 42%, #15803d55, #0d3d2200 72%)',
      borderRadius:14, marginBottom:4}}>

      {/* Opponent seats */}
      {seats.map(s=>(
        <OppChip key={s.idx} idx={s.idx} game={game} cur={cur} aiStatus={aiStatus}
          style={{ left:`${s.leftPct}%`, top:s.top }}/>
      ))}

      {/* Center table */}
      <div style={{
        position:'absolute', left:'50%', bottom:8, transform:'translateX(-50%)',
        width:'62%', maxWidth:340, minHeight:128,
        background:'#0d4a2eaa', border:`2px solid ${borderColor}`, borderRadius:12,
        padding:8, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:5, transition:'border 0.3s', overflow:'hidden',
      }}>
        {game.phase==='result' && (
          <ResultGraphic type={game.resultType} cards={game.roundCards}
            takerName={NAMES[game.nextLeader]} count={game.roundCards.length}/>
        )}

        {game.ledSuit && (
          <div style={{fontSize:11,color:'#86efac',display:'flex',alignItems:'center',gap:4}}>
            Led: <span style={{fontSize:20,color:IS_RED(game.ledSuit)?'#fca5a5':'#f0fdf4',lineHeight:1}}>{game.ledSuit}</span>
          </div>
        )}

        <div style={{display:'flex',flexWrap:'wrap',gap:5,justifyContent:'center',alignItems:'flex-end'}}>
          {game.roundCards.length===0
            ? <div style={{color:'#4ade8033',fontSize:12,padding:'6px 0'}}>— table empty —</div>
            : game.roundCards.map((rc,i)=>{
                const isHighest = highestCard && rc.player===highestCard.player && rc.card.rank===highestCard.card.rank && rc.card.suit===highestCard.card.suit;
                const isCutCard = game.ledSuit && rc.card.suit !== game.ledSuit;
                return (
                  <div key={i} style={{textAlign:'center'}}>
                    <div style={{fontSize:9,color:'#86efacaa',marginBottom:2}}>{NAMES[rc.player]}</div>
                    <CardFace card={rc.card} tiny highlight={game.phase==='result' && isHighest} glow={isCutCard}/>
                  </div>
                );
              })
          }
        </div>

        {game.phase==='result' && (
          <div style={{background:game.resultType==='cut'?'#7f1d1d':'#1e1b4b',
            border:`1.5px solid ${game.resultType==='cut'?'#ef4444':'#6366f1'}`,
            borderRadius:8,padding:'5px 10px',textAlign:'center',fontSize:11,
            color:game.resultType==='cut'?'#fca5a5':'#a5b4fc',fontWeight:600,maxWidth:220,
            animation:'pulse 1s ease infinite'}}>
            {game.resultMsg}
          </div>
        )}

        {game.phase==='playing' && (
          <div style={{fontSize:11,fontStyle:'italic',color:cur===0?'#fde68a':'#86efacaa'}}>
            {cur===0?'⭐ Your turn':aiStatus?`🤖 ${aiStatus}`:cur>=0?`${NAMES[cur]}'s turn`:''}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
// ── Persistence layer (artifact storage) ─────────────────────────────────────
// NOTE: This is a working web prototype. Real cross-device accounts + Android
// require a hosted backend. The schema below maps 1:1 to a real DB (see notes).
//
//   TABLE users        (username PK, pin_hash, created_at)
//   TABLE games         (id PK, owner FK->users, played_at, result, opponents[], placement)
//   TABLE user_stats    (username FK, played, wins, losses, current_streak, best_streak)
//
const store = {
  async get(key, fallback=null) {
    try { const r = await window.storage.get(key, false); return r ? JSON.parse(r.value) : fallback; }
    catch { return fallback; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val), false); return true; }
    catch(e){ console.error('store.set failed', e); return false; }
  },
  async del(key) {
    try { await window.storage.delete(key, false); } catch {}
  },
};

// trivial obfuscation — NOT real security (a real backend must hash server-side)
const hashPin = pin => btoa(String(pin).split('').reverse().join('') + '·ace');

async function loadAccounts(){ return await store.get('accounts', {}); }
async function saveAccounts(a){ return await store.set('accounts', a); }

async function recordGame(username, { won, placement, opponents }) {
  const statsKey = `stats:${username}`;
  const stats = await store.get(statsKey, { played:0, wins:0, losses:0, streak:0, bestStreak:0, history:[] });
  stats.played += 1;
  if (won) { stats.wins += 1; stats.streak += 1; stats.bestStreak = Math.max(stats.bestStreak, stats.streak); }
  else { stats.losses += 1; stats.streak = 0; }
  stats.history.unshift({
    at: Date.now(), won, placement,
    opponents, mode:'vs AI',
  });
  stats.history = stats.history.slice(0, 50);
  await store.set(statsKey, stats);
  return stats;
}

// ── Auth screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    const u = username.trim().toLowerCase();
    if (u.length < 3) return setErr('Username must be at least 3 characters');
    if (!/^[a-z0-9_]+$/.test(u)) return setErr('Use only letters, numbers, underscore');
    if (pin.length < 4) return setErr('PIN must be at least 4 digits');
    setBusy(true);
    const accounts = await loadAccounts();
    if (mode === 'signup') {
      if (accounts[u]) { setBusy(false); return setErr('Username already taken'); }
      accounts[u] = { username:u, pinHash:hashPin(pin), createdAt:Date.now() };
      await saveAccounts(accounts);
      await store.set('session', { username:u });
      setBusy(false);
      onLogin(u);
    } else {
      const acc = accounts[u];
      if (!acc || acc.pinHash !== hashPin(pin)) { setBusy(false); return setErr('Wrong username or PIN'); }
      await store.set('session', { username:u });
      setBusy(false);
      onLogin(u);
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'radial-gradient(ellipse at 50% 30%,#1a7a4f,#0a2e1c 75%)',
      fontFamily:'Georgia,serif',padding:20,boxSizing:'border-box'}}>
      <div style={{width:'100%',maxWidth:360,textAlign:'center'}}>
        {/* Logo */}
        <div style={{marginBottom:6}}>
          <div style={{fontSize:64,lineHeight:1,filter:'drop-shadow(0 4px 12px #0006)'}}>♠</div>
          <div style={{fontSize:36,fontWeight:700,letterSpacing:8,color:'#4ade80',marginTop:4}}>ACE</div>
          <div style={{fontSize:12,color:'#86efac99',letterSpacing:2,marginTop:2}}>THE CUTTHROAT CARD GAME</div>
        </div>

        <div style={{background:'#0f3d28cc',border:'1.5px solid #16653488',borderRadius:16,
          padding:'26px 22px',marginTop:24,boxShadow:'0 12px 40px #0006',backdropFilter:'blur(4px)'}}>
          <div style={{display:'flex',gap:0,marginBottom:20,background:'#06281a',borderRadius:9,padding:3}}>
            {['login','signup'].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setErr('');}} style={{
                flex:1,padding:'8px',borderRadius:7,border:'none',cursor:'pointer',
                fontSize:13,fontFamily:'Georgia,serif',fontWeight:700,letterSpacing:0.5,
                background: mode===m?'#16a34a':'transparent',
                color: mode===m?'#fff':'#86efac99',transition:'all 0.15s',
              }}>{m==='login'?'Log In':'Sign Up'}</button>
            ))}
          </div>

          <input
            value={username} onChange={e=>setUsername(e.target.value)}
            placeholder="username" autoCapitalize="off" autoCorrect="off"
            onKeyDown={e=>e.key==='Enter'&&submit()}
            style={inputStyle}
          />
          <input
            value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}
            placeholder="PIN (4+ digits)" type="password" inputMode="numeric"
            onKeyDown={e=>e.key==='Enter'&&submit()}
            style={{...inputStyle, marginTop:10}}
          />

          {err && <div style={{color:'#fca5a5',fontSize:12,marginTop:12,textAlign:'left'}}>⚠ {err}</div>}

          <button onClick={submit} disabled={busy} style={{
            width:'100%',marginTop:18,padding:'12px',borderRadius:9,border:'none',
            background: busy?'#166534':'linear-gradient(135deg,#16a34a,#15803d)',
            color:'#fff',fontSize:15,fontWeight:700,fontFamily:'Georgia,serif',
            letterSpacing:1,cursor:busy?'wait':'pointer',boxShadow:'0 4px 14px #0004',
          }}>
            {busy ? '…' : mode==='login' ? 'Enter Table' : 'Create Account'}
          </button>

          <div style={{fontSize:10,color:'#86efac66',marginTop:16,lineHeight:1.5}}>
            Prototype accounts are stored on this device.<br/>Don't reuse a real password as your PIN.
          </div>
        </div>
      </div>
    </div>
  );
}
const inputStyle = {
  width:'100%',boxSizing:'border-box',padding:'11px 14px',borderRadius:9,
  border:'1.5px solid #16653488',background:'#06281a',color:'#f0fdf4',
  fontSize:15,fontFamily:'Georgia,serif',outline:'none',
};

// ── Settings panel ────────────────────────────────────────────────────────────
function SettingsPanel({ username, stats, onClose, onLogout, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const winRate = stats && stats.played ? Math.round((stats.wins/stats.played)*100) : 0;

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:2000,
      background:'#021a10cc',backdropFilter:'blur(3px)',
      display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'40px 16px',overflowY:'auto'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:420,
        background:'linear-gradient(160deg,#0f3d28,#08291a)',border:'1.5px solid #166534',
        borderRadius:16,padding:'22px',boxShadow:'0 20px 60px #0008',fontFamily:'Georgia,serif'}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div>
            <div style={{fontSize:11,color:'#86efac99',letterSpacing:1}}>SIGNED IN AS</div>
            <div style={{fontSize:22,fontWeight:700,color:'#4ade80'}}>@{username}</div>
          </div>
          <button onClick={onClose} style={{background:'#06281a',border:'1px solid #16653488',
            color:'#86efac',width:32,height:32,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:18}}>
          {[['Played',stats?.played||0],['Wins',stats?.wins||0],['Win %',winRate+'%'],['Streak',stats?.bestStreak||0]].map(([l,v])=>(
            <div key={l} style={{background:'#06281a',borderRadius:10,padding:'10px 4px',textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:700,color:'#fff'}}>{v}</div>
              <div style={{fontSize:9,color:'#86efac99',letterSpacing:0.5,marginTop:2}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* History */}
        <div style={{fontSize:11,color:'#86efac99',letterSpacing:1,marginBottom:8}}>RECENT GAMES</div>
        <div style={{maxHeight:180,overflowY:'auto',display:'flex',flexDirection:'column',gap:6,marginBottom:18}}>
          {(!stats || stats.history.length===0)
            ? <div style={{color:'#86efac66',fontSize:12,padding:'12px 0',textAlign:'center'}}>No games yet — play one!</div>
            : stats.history.map((h,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                background:'#06281a',borderRadius:8,padding:'8px 12px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{h.won?'🏆':'💀'}</span>
                  <div>
                    <div style={{fontSize:13,color:h.won?'#4ade80':'#fca5a5',fontWeight:700}}>
                      {h.won?'Won':'Lost'} <span style={{color:'#86efac88',fontWeight:400}}>· {h.mode}</span>
                    </div>
                    <div style={{fontSize:10,color:'#86efac77'}}>vs {h.opponents.join(', ')}</div>
                  </div>
                </div>
                <div style={{fontSize:10,color:'#86efac77'}}>{timeAgo(h.at)}</div>
              </div>
            ))
          }
        </div>

        {/* Actions */}
        <button onClick={onLogout} style={{width:'100%',padding:'11px',borderRadius:9,
          border:'1.5px solid #16653488',background:'#06281a',color:'#86efac',
          fontSize:14,fontFamily:'Georgia,serif',fontWeight:700,cursor:'pointer',marginBottom:10}}>
          Log Out
        </button>

        {!confirmDel ? (
          <button onClick={()=>setConfirmDel(true)} style={{width:'100%',padding:'11px',borderRadius:9,
            border:'1.5px solid #7f1d1d',background:'transparent',color:'#fca5a5',
            fontSize:13,fontFamily:'Georgia,serif',cursor:'pointer'}}>
            Delete Account
          </button>
        ) : (
          <div style={{background:'#2d0a0a',border:'1.5px solid #7f1d1d',borderRadius:9,padding:12}}>
            <div style={{fontSize:12,color:'#fca5a5',marginBottom:10,textAlign:'center'}}>
              Permanently delete @{username} and all stats? This cannot be undone.
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setConfirmDel(false)} style={{flex:1,padding:'9px',borderRadius:8,
                border:'1px solid #16653488',background:'#06281a',color:'#86efac',
                fontFamily:'Georgia,serif',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={onDelete} style={{flex:1,padding:'9px',borderRadius:8,border:'none',
                background:'#dc2626',color:'#fff',fontFamily:'Georgia,serif',fontWeight:700,
                cursor:'pointer',fontSize:13}}>Delete Forever</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function timeAgo(ts){
  const s=(Date.now()-ts)/1000;
  if(s<60)return 'just now';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}

// ── Lobby: choose number of opponents ─────────────────────────────────────────
function Lobby({ username, onStart, onOpenSettings }) {
  const [opponents, setOpponents] = useState(3);
  const [useAI, setUseAI] = useState(AI_ENABLED);
  const total = opponents + 1;

  return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at 50% 30%,#1a7a4f,#0a2e1c 75%)',
      fontFamily:'Georgia,serif',color:'#fff',padding:'16px',boxSizing:'border-box'}}>
      {/* header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',maxWidth:440,margin:'0 auto 20px'}}>
        <div>
          <span style={{fontSize:22,fontWeight:700,letterSpacing:3,color:'#4ade80'}}>♠ ACE</span>
          <span style={{fontSize:11,color:'#4ade8088',marginLeft:8}}>@{username}</span>
        </div>
        <button onClick={onOpenSettings} title="Settings" style={{background:'#0f3d28',border:'1px solid #4ade8066',color:'#4ade80',borderRadius:8,width:34,height:32,cursor:'pointer',fontSize:16}}>⚙</button>
      </div>

      <div style={{maxWidth:440,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:8,fontSize:13,color:'#86efac',letterSpacing:1}}>NEW GAME · vs AI</div>
        <div style={{textAlign:'center',fontSize:26,fontWeight:700,color:'#f0fdf4',marginBottom:24}}>
          How many opponents?
        </div>

        {/* Opponent count selector */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:24}}>
          {[3,4,5,6,7].map(n=>(
            <button key={n} onClick={()=>setOpponents(n)} style={{
              aspectRatio:'1', borderRadius:12, cursor:'pointer',
              border: opponents===n ? '2.5px solid #fbbf24' : '1.5px solid #16653488',
              background: opponents===n ? 'linear-gradient(160deg,#16a34a,#15803d)' : '#0f3d28',
              color: opponents===n ? '#fff' : '#86efac',
              fontSize:24, fontWeight:700, fontFamily:'Georgia,serif',
              boxShadow: opponents===n ? '0 6px 18px #16a34a55' : 'none',
              transition:'all 0.15s', transform: opponents===n?'scale(1.05)':'scale(1)',
            }}>{n}</button>
          ))}
        </div>

        {/* Table preview */}
        <TablePreview total={total} />

        <div style={{textAlign:'center',color:'#86efac',fontSize:13,margin:'18px 0 18px'}}>
          {total} players at the table · 52 cards dealt{' '}
          <span style={{color:'#fde68a'}}>~{Math.floor(52/total)}–{Math.ceil(52/total)} each</span>
        </div>

        {/* Opponent brain toggle — only shown when AI is enabled by config */}
        {AI_ENABLED && (
          <>
            <div style={{fontSize:12,color:'#86efac',letterSpacing:1,marginBottom:8,textAlign:'center'}}>OPPONENT TYPE</div>
            <div style={{display:'flex',gap:8,marginBottom:24}}>
              {[
                {v:true, t:'🧠 Smart AI', d:'Claude reasons each move (needs backend)'},
                {v:false,t:'⚡ Quick Bots', d:'Instant local logic, always works'},
              ].map(opt=>(
                <button key={String(opt.v)} onClick={()=>setUseAI(opt.v)} style={{
                  flex:1, textAlign:'left', cursor:'pointer', borderRadius:12, padding:'12px 14px',
                  border: useAI===opt.v ? '2.5px solid #fbbf24' : '1.5px solid #16653488',
                  background: useAI===opt.v ? 'linear-gradient(160deg,#16a34a,#15803d)' : '#0f3d28',
                  color:'#fff', fontFamily:'Georgia,serif', transition:'all 0.15s',
                }}>
                  <div style={{fontSize:15,fontWeight:700,marginBottom:3}}>{opt.t}</div>
                  <div style={{fontSize:10.5,color: useAI===opt.v ? '#dcfce7' : '#86efac99',lineHeight:1.4}}>{opt.d}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={()=>onStart(opponents, AI_ENABLED && useAI)} style={{
          width:'100%', padding:'15px', borderRadius:12, border:'none',
          background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff',
          fontSize:17, fontWeight:700, fontFamily:'Georgia,serif', letterSpacing:1,
          cursor:'pointer', boxShadow:'0 6px 20px #16a34a44',
        }}>
          Deal & Start ♠
        </button>
      </div>
    </div>
  );
}

// Small visual preview of seats around the table
function TablePreview({ total }) {
  const size = 220, cx = size/2, cy = size/2, rx = size*0.40, ry = size*0.34;
  const seats = [];
  // seat 0 = you at bottom
  seats.push({ x: cx, y: cy + ry, me:true, label:'You' });
  const m = total - 1;
  for (let i=0;i<m;i++){
    const f = (i+1)/(m+1);
    const angle = Math.PI - f*Math.PI; // left → top → right
    seats.push({ x: cx + rx*Math.cos(angle), y: cy - ry*Math.sin(angle), me:false, label:NAMES[i+1] });
  }
  return (
    <div style={{position:'relative', width:size, height:size, margin:'0 auto'}}>
      {/* felt */}
      <div style={{position:'absolute', left:cx-rx-6, top:cy-ry-6, width:(rx+6)*2, height:(ry+6)*2,
        borderRadius:'50%', background:'radial-gradient(ellipse,#15803d,#0d4a2e)',
        border:'2px solid #16a34a55', boxShadow:'inset 0 2px 14px #0006'}}/>
      <div style={{position:'absolute',left:0,top:cy-9,width:size,textAlign:'center',color:'#4ade8088',fontSize:13,letterSpacing:2}}>♠ ACE</div>
      {seats.map((s,i)=>(
        <div key={i} style={{position:'absolute', left:s.x-18, top:s.y-18, width:36, height:36,
          borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
          background: s.me ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
          border: s.me ? '2px solid #fff' : '1.5px solid #60a5fa',
          color:'#fff', fontSize:9, fontWeight:700, textAlign:'center', lineHeight:1,
          boxShadow:'0 2px 8px #0005'}}>
          {s.me ? '★' : s.label.slice(0,3)}
        </div>
      ))}
    </div>
  );
}

// ── App root: handles auth + routing ──────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState(null);
  const [screen, setScreen] = useState('lobby');     // 'lobby' | 'game'
  const [nOpponents, setNOpponents] = useState(3);
  const [useAI, setUseAI] = useState(true);

  // restore session on load
  useEffect(() => {
    (async () => {
      const session = await store.get('session', null);
      if (session?.username) {
        const accounts = await loadAccounts();
        if (accounts[session.username]) setUser(session.username);
      }
      setChecking(false);
    })();
  }, []);

  const refreshStats = async (u=user) => {
    if (!u) return;
    setStats(await store.get(`stats:${u}`, { played:0,wins:0,losses:0,streak:0,bestStreak:0,history:[] }));
  };
  useEffect(() => { if (user) refreshStats(user); }, [user]);

  const handleLogin = (u) => { setUser(u); setScreen('lobby'); };
  const handleLogout = async () => { await store.del('session'); setUser(null); setShowSettings(false); setStats(null); setScreen('lobby'); };
  const handleDelete = async () => {
    const accounts = await loadAccounts();
    delete accounts[user];
    await saveAccounts(accounts);
    await store.del(`stats:${user}`);
    await store.del('session');
    setUser(null); setShowSettings(false); setStats(null); setScreen('lobby');
  };
  const handleGameEnd = async (result) => {
    const s = await recordGame(user, result);
    setStats(s);
  };
  const startGame = (opp, ai) => { setNOpponents(opp); setUseAI(ai); setScreen('game'); };

  if (checking) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'#0a2e1c',color:'#4ade80',fontFamily:'Georgia,serif',fontSize:40}}>♠</div>
  );

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  return (
    <>
      {screen === 'lobby' ? (
        <Lobby
          username={user}
          onStart={startGame}
          onOpenSettings={()=>{ refreshStats(); setShowSettings(true); }}
        />
      ) : (
        <GameScreen
          key={`${nOpponents}-${useAI}`}
          username={user}
          nPlayers={nOpponents + 1}
          useAI={useAI}
          onExit={()=>setScreen('lobby')}
          onOpenSettings={()=>{ refreshStats(); setShowSettings(true); }}
          onGameEnd={handleGameEnd}
        />
      )}
      {showSettings && (
        <SettingsPanel
          username={user} stats={stats}
          onClose={()=>setShowSettings(false)}
          onLogout={handleLogout}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────
function GameScreen({ username, nPlayers, useAI, onExit, onOpenSettings, onGameEnd }) {
  const [game, setGame] = useState(() => initGame(nPlayers));
  const [aiStatus, setAiStatus] = useState('');
  const [aiNotice, setAiNotice] = useState('');     // fallback notice text
  const logRef = useRef(null);
  const aiInFlight = useRef(false);
  const reportedRef = useRef(false);

  // Report result to account stats exactly once when the game ends
  useEffect(() => {
    if (game.phase === 'gameOver' && !reportedRef.current) {
      reportedRef.current = true;
      const won = game.loser !== 0;
      const placement = game.finished.indexOf(0);
      onGameEnd && onGameEnd({
        won,
        placement: placement >= 0 ? placement + 1 : game.n,
        opponents: NAMES.slice(1, game.n),
      });
    }
    if (game.phase !== 'gameOver') reportedRef.current = false;
  }, [game.phase]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [game.log]);

  // Show result for 2.5s then move to next round
  useEffect(() => {
    if (game.phase !== 'result') return;
    const t = setTimeout(() => {
      setGame(g => {
        if (g.phase !== 'result') return g;
        const next = resolveRound(g);
        // if next phase is playing and it's AI's turn, flag it
        if (next.phase === 'playing') {
          const cur = next.roundOrder[next.turnIdx];
          return { ...next, pendingAI: cur !== 0 };
        }
        return next;
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [game.phase, game.resultMsg]);

  // AI trigger — watch pendingAI flag
  useEffect(() => {
    if (!game.pendingAI) return;
    if (game.phase !== 'playing') return;
    const cur = game.roundOrder[game.turnIdx];
    if (cur === 0) return;
    if (aiInFlight.current) return;

    aiInFlight.current = true;
    const snapshot = JSON.parse(JSON.stringify(game));

    // Path 1: AI off (config disabled or Quick Bots chosen) → local bot, instant
    if (!useAI) {
      const card = smartFallback(snapshot, cur, legalMoves(snapshot, cur));
      setTimeout(() => {
        aiInFlight.current = false;
        setGame(g => {
          if (g.phase !== 'playing' || g.roundOrder[g.turnIdx] !== cur) return g;
          return { ...applyPlay(g, cur, card), pendingAI: false };
        });
      }, 400 + Math.random() * 300);
      return;
    }

    // Path 2: AI on → ask backend every turn (mode is locked for the whole game).
    // If a single call fails we fall back for THAT turn only and keep using AI next turn.
    setAiStatus(`${NAMES[cur]} is thinking...`);
    setTimeout(() => {
      askAI(snapshot, cur).then(({ card, usedAI, reason }) => {
        aiInFlight.current = false;
        setAiStatus('');
        if (!usedAI && !SESSION_AI_NOTIFIED) {
          SESSION_AI_NOTIFIED = true; // notify only ONCE per session
          setAiNotice(`AI unreachable (${reason}). Falling back to quick bots when needed.`);
          setTimeout(() => setAiNotice(''), 6000);
        }
        setGame(g => {
          if (g.phase !== 'playing' || g.roundOrder[g.turnIdx] !== cur) return g;
          return { ...applyPlay(g, cur, card), pendingAI: false };
        });
      });
    }, 500 + Math.random() * 350);
  }, [game.pendingAI, game.turnIdx, useAI]);

  // Kick off AI when pendingAI resets after result clears
  useEffect(() => {
    if (game.phase === 'playing' && !game.pendingAI) {
      const cur = game.roundOrder[game.turnIdx];
      if (cur !== 0 && !aiInFlight.current) {
        setGame(g => ({ ...g, pendingAI: true }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.turnIdx]);

  const isMyTurn = game.phase==='playing' && game.roundOrder[game.turnIdx]===0;
  const myHand = [...game.hands[0]].sort((a,b)=>SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)||RANK_VAL[a.rank]-RANK_VAL[b.rank]);

  const validSet = new Set();
  if (isMyTurn) {
    const h = game.hands[0];
    if (game.ledSuit) { const s=h.filter(c=>c.suit===game.ledSuit); (s.length?s:h).forEach(c=>validSet.add(c.suit+c.rank)); }
    else h.forEach(c=>validSet.add(c.suit+c.rank));
  }

  const cur = game.phase==='playing' ? game.roundOrder[game.turnIdx] : -1;
  const highestCard = game.roundCards.length && game.ledSuit ? highestOf(game.roundCards, game.ledSuit) : null;

  const newGame = () => { aiInFlight.current=false; setAiStatus(''); reportedRef.current=false; setGame(initGame(nPlayers)); };

  return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at 50% 40%,#166534,#0d3d22)',fontFamily:'Georgia,serif',color:'#fff',padding:'10px',boxSizing:'border-box'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',maxWidth:540,margin:'0 auto 8px'}}>
        <div>
          <span style={{fontSize:20,fontWeight:700,letterSpacing:3,color:'#4ade80'}}>♠ ACE</span>
          <span style={{fontSize:11,color:'#4ade8088',marginLeft:8}}>@{username}</span>
          <span style={{fontSize:10,marginLeft:8,padding:'2px 7px',borderRadius:6,
            background: useAI ? '#1e3a5f' : '#3f2d1a',
            color: useAI ? '#93c5fd' : '#fcd34d',
            border:`1px solid ${useAI ? '#3b82f6' : '#a16207'}`}}>
            {useAI ? 'Smart AI' : 'Quick bots'}
          </span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={onExit} style={{background:'transparent',border:'1px solid #4ade8066',color:'#4ade80',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,fontFamily:'Georgia,serif'}}>← Lobby</button>
          <button onClick={newGame} style={{background:'transparent',border:'1px solid #4ade8066',color:'#4ade80',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,fontFamily:'Georgia,serif'}}>Redeal</button>
          <button onClick={onOpenSettings} title="Settings" style={{background:'#0f3d28',border:'1px solid #4ade8066',color:'#4ade80',borderRadius:8,width:32,height:30,cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center'}}>⚙</button>
        </div>
      </div>

      {aiNotice && (
        <div style={{maxWidth:540,margin:'0 auto 8px',background:'#3f2d1a',border:'1px solid #a16207',
          borderRadius:8,padding:'8px 12px',fontSize:12,color:'#fcd34d',display:'flex',
          alignItems:'center',justifyContent:'space-between',gap:8}}>
          <span>⚠ {aiNotice}</span>
          <button onClick={()=>setAiNotice('')} style={{background:'transparent',border:'none',
            color:'#fcd34d99',cursor:'pointer',fontSize:14}}>✕</button>
        </div>
      )}

      <div style={{maxWidth:540,margin:'0 auto',display:'flex',flexDirection:'column',gap:6}}>

        {game.phase==='gameOver' && (
          <div style={{background:'linear-gradient(135deg,#1c1917,#292524)',border:`2px solid ${game.loser===0?'#ef4444':'#4ade80'}`,borderRadius:12,padding:'20px',textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:6}}>{game.loser===0?'💀':'🏆'}</div>
            <div style={{fontSize:22,fontWeight:700,marginBottom:4,color:game.loser===0?'#fca5a5':'#4ade80'}}>{game.loser===0?'You Lost!':'You Won!'}</div>
            <div style={{color:'#a8a29e',fontSize:13,marginBottom:14}}>{game.loser!=null?`${NAMES[game.loser]} is the last one holding cards!`:''}</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={newGame} style={{background:game.loser===0?'#dc2626':'#16a34a',border:'none',color:'#fff',borderRadius:8,padding:'10px 24px',cursor:'pointer',fontSize:14,fontFamily:'Georgia,serif',fontWeight:700}}>Redeal ({game.n})</button>
              <button onClick={onExit} style={{background:'transparent',border:'1.5px solid #4ade8066',color:'#4ade80',borderRadius:8,padding:'10px 24px',cursor:'pointer',fontSize:14,fontFamily:'Georgia,serif',fontWeight:700}}>Lobby</button>
            </div>
          </div>
        )}

        {/* Arena: opponents seated around an arc, table in the middle */}
        <Arena
          game={game}
          cur={cur}
          aiStatus={aiStatus}
          highestCard={highestCard}
        />

        {/* My status bar */}
        <div style={{background:isMyTurn?'#fef9c311':'#14532d44',border:`1.5px solid ${isMyTurn?'#fde68a':'#166534'}`,borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{color:'#4ade80',fontWeight:700,fontSize:13}}>You</span>
          <span style={{color:'#86efac',fontSize:12}}>
            {myHand.length} cards
            {isMyTurn&&!game.ledSuit&&' · Lead any card'}
            {isMyTurn&&game.ledSuit&&game.hands[0].some(c=>c.suit===game.ledSuit)&&` · Follow ${game.ledSuit}`}
            {isMyTurn&&game.ledSuit&&!game.hands[0].some(c=>c.suit===game.ledSuit)&&' · Must cut! (no '+game.ledSuit+')'}
          </span>
          {game.finished.includes(0)&&<span style={{fontSize:12,color:'#4ade80'}}>✅ #{game.finished.indexOf(0)+1}</span>}
        </div>

        {/* Fanned Hand */}
        <FannedHand
          cards={myHand}
          validSet={validSet}
          isMyTurn={isMyTurn}
          onPlay={card=>setGame(g=>{ if(g.phase!=='playing') return g; return applyPlay(g,0,card); })}
          phase={game.phase}
        />

        {/* Log */}
        <div ref={logRef} style={{background:'#0f172a99',border:'1px solid #1e293b',borderRadius:8,padding:'6px 10px',maxHeight:90,overflowY:'auto',fontSize:11,lineHeight:1.7,scrollbarWidth:'thin',scrollbarColor:'#1e293b transparent'}}>
          {game.log.slice(-20).map((l,i,arr)=>(
            <div key={i} style={{color:i===arr.length-1?'#fde68a':i===arr.length-2?'#94a3b8':'#475569'}}>{l}</div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.75}}
        @keyframes flashBg{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
        @keyframes popEmblem{0%{transform:scale(0) rotate(-12deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
        @keyframes flyDead{
          0%{transform:translate(0,0) rotate(0) scale(1);opacity:1}
          40%{opacity:1}
          100%{transform:translate(var(--dx),-130px) rotate(var(--rot)) scale(0.4);opacity:0}
        }
        @keyframes flySwept{
          0%{transform:translate(0,0) scale(1);opacity:1}
          35%{transform:translate(var(--dx),0) scale(1);opacity:1}
          100%{transform:translate(0,150px) scale(0.3);opacity:0}
        }
        @keyframes ember{
          0%{transform:translate(0,0) scale(1);opacity:1}
          100%{transform:translate(var(--ex),var(--ey)) scale(0);opacity:0}
        }
      `}</style>
    </div>
  );
}
