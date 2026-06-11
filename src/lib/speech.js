// Lightweight wrapper around the Web Speech API so Zeus can read replies aloud.
// No external deps — uses the browser's built-in speechSynthesis.

// Turn markdown into something that sounds natural when spoken: drop code blocks,
// strip formatting characters, collapse whitespace.
export function stripForSpeech(md = '') {
  return String(md)
    .replace(/```[\s\S]*?```/g, '. (code block) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[#*_>~|]/g, '')
    .replace(/https?:\/\/\S+/g, ' link ')
    .replace(/\s*\n{2,}\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

let cachedVoice = null;

function pickVoice() {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  if (cachedVoice) return cachedVoice;
  const voices = synth.getVoices() || [];
  if (!voices.length) return null;
  // Prefer a crisp English male voice for the JARVIS vibe, else any English voice.
  cachedVoice =
    voices.find(v => /Daniel|Google UK English Male|Microsoft (Guy|David|Mark)|Male/i.test(v.name)) ||
    voices.find(v => /en[-_]GB/i.test(v.lang)) ||
    voices.find(v => /^en/i.test(v.lang)) ||
    voices[0];
  return cachedVoice;
}

// Some browsers load voices asynchronously — warm the cache when they arrive.
if (typeof window !== 'undefined' && window.speechSynthesis) {
  try {
    window.speechSynthesis.onvoiceschanged = () => { cachedVoice = null; pickVoice(); };
    pickVoice();
  } catch {}
}

export function isSpeaking() {
  return !!(window.speechSynthesis && window.speechSynthesis.speaking);
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch {}
}

// Speak `text`. onWord fires on each word boundary (drives the reactive orb);
// onStart / onEnd bracket the utterance. Returns true if speech started.
export function speak(text, { rate = 1, pitch = 1 } = {}, { onStart, onWord, onEnd } = {}) {
  const synth = window.speechSynthesis;
  if (!synth) return false;
  const clean = stripForSpeech(text);
  if (!clean) return false;

  synth.cancel(); // never overlap utterances
  const utter = new SpeechSynthesisUtterance(clean.slice(0, 1200));
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  utter.rate = Math.min(Math.max(rate, 0.5), 2);
  utter.pitch = Math.min(Math.max(pitch, 0), 2);

  utter.onstart = () => onStart?.();
  utter.onboundary = (e) => { if (e.name === 'word' || e.charIndex != null) onWord?.(); };
  utter.onend = () => onEnd?.();
  utter.onerror = () => onEnd?.();

  synth.speak(utter);
  return true;
}
