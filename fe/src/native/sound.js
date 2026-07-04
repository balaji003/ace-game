// Sound cues. The card-play cue is a real mp3 (bundled by Vite, so it ships in
// both the web and native builds); the rest are synthesized with the Web Audio
// API (no asset files). Honors a persisted mute flag. Works in a browser and
// the native WebView.

import cardFlipUrl from '../assets/sounds/card_flip.wav';

const MUTE_KEY = 'ace_muted';
let ctx = null;
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

// Preloaded 0.5s card-flip cue (light-card sample, trimmed). currentTime reset allows rapid replays.
const cardFlip = typeof Audio !== 'undefined' ? new Audio(cardFlipUrl) : null;
if (cardFlip) cardFlip.preload = 'auto';
function playCardFlip() {
  if (muted || !cardFlip) return;
  try { cardFlip.currentTime = 0; cardFlip.play().catch(() => {}); } catch {}
}

export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// A single tone scheduled at an absolute AudioContext time.
function tone(ac, at, freq, dur, type = 'sine', gain = 0.16) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur);
}

// A short white-noise burst (card whoosh / shuffle click) at an absolute time.
function noiseBurst(ac, at, dur, gain = 0.1, highpass = 900) {
  const n = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = highpass;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filt).connect(g).connect(ac.destination);
  src.start(at);
  src.stop(at + dur);
}

// Dealing: a quick shuffle riffle followed by a run of card ticks. Timed to
// roughly match the DealAnimation (shuffle lead-in, then cards flying out).
function dealSeq() {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  // Shuffle riffle (~0.6s): soft high clicks.
  for (let i = 0; i < 14; i++) {
    noiseBurst(ac, t0 + i * 0.035 + Math.random() * 0.008, 0.03, 0.045, 1600);
  }
  // Dealing (~1.5s): a run of light card ticks + tiny whooshes.
  const start = t0 + 0.66;
  for (let i = 0; i < 18; i++) {
    const at = start + i * 0.082;
    tone(ac, at, 520 + Math.random() * 200, 0.045, 'triangle', 0.08);
    noiseBurst(ac, at, 0.028, 0.035, 1200);
  }
}

// Cards go DEAD: a soft descending "poof" + whoosh as they leave the game.
function deadSeq() {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, 300, 0.14, 'sine', 0.14);
  tone(ac, t + 0.06, 175, 0.24, 'triangle', 0.13);
  noiseBurst(ac, t, 0.2, 0.07, 450);
}

// Play a sequence of {freq, dur, type, gain} notes.
function play(notes) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  let t = ac.currentTime;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type || 'sine';
    osc.frequency.value = n.freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(n.gain ?? 0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + n.dur);
    t += n.dur;
  }
}

export const sounds = {
  turn:  () => play([{ freq: 880, dur: 0.09, type: 'triangle' }]),
  play:  () => playCardFlip(),   // synthesized 0.5s card-flip WAV
  cut:   () => play([{ freq: 440, dur: 0.1, type: 'sawtooth' }, { freq: 300, dur: 0.12, type: 'sawtooth' }]),
  dead:  () => deadSeq(),         // cards go dead — soft descending poof
  deal:  () => dealSeq(),         // start-of-game shuffle + deal
  win:   () => play([{ freq: 523, dur: 0.12 }, { freq: 659, dur: 0.12 }, { freq: 784, dur: 0.18 }]),
  lose:  () => play([{ freq: 300, dur: 0.18, type: 'sawtooth' }, { freq: 200, dur: 0.25, type: 'sawtooth' }]),
};
