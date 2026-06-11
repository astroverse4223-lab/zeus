// Tiny synthesized UI sound effects — no audio files, just WebAudio oscillators.
import useStore from '../store/useStore.js';

let ctx;
function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function blip(freqs, { dur = 0.12, type = 'sine', gain = 0.04, slideTo = null } = {}) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime;
  const master = a.createGain();
  master.connect(a.destination);
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  (Array.isArray(freqs) ? freqs : [freqs]).forEach(f => {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    o.connect(master);
    o.start(t0);
    o.stop(t0 + dur);
  });
}

const SOUNDS = {
  send:    () => blip(520,        { type: 'triangle', dur: 0.09, gain: 0.05, slideTo: 880 }),
  receive: () => blip([660, 988], { type: 'sine',     dur: 0.14, gain: 0.04 }),
  tool:    () => blip(440,        { type: 'square',   dur: 0.045, gain: 0.02 }),
  error:   () => blip(220,        { type: 'sawtooth', dur: 0.24, gain: 0.05, slideTo: 110 }),
  toggle:  () => blip(720,        { type: 'sine',     dur: 0.07, gain: 0.05 }),
};

// Play a sound by name, respecting the user's sound toggle. `force` ignores the toggle
// (used for the toggle-on click itself so the user hears the confirmation).
export function playSfx(name, force = false) {
  try {
    if (!force && !useStore.getState().soundEnabled) return;
    SOUNDS[name]?.();
  } catch {}
}
