// Lightweight sound cues synthesized with the Web Audio API — no asset files,
// works in both a browser and the native WebView. Honors a persisted mute flag.

const MUTE_KEY = 'ace_muted';
let ctx = null;
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

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
  play:  () => play([{ freq: 520, dur: 0.07, type: 'square', gain: 0.12 }]),
  cut:   () => play([{ freq: 440, dur: 0.1, type: 'sawtooth' }, { freq: 300, dur: 0.12, type: 'sawtooth' }]),
  win:   () => play([{ freq: 523, dur: 0.12 }, { freq: 659, dur: 0.12 }, { freq: 784, dur: 0.18 }]),
  lose:  () => play([{ freq: 300, dur: 0.18, type: 'sawtooth' }, { freq: 200, dur: 0.25, type: 'sawtooth' }]),
};
