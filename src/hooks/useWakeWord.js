import { useEffect, useRef, useCallback } from 'react';

export default function useWakeWord({ enabled, onWake }) {
  const recRef   = useRef(null);
  const timerRef = useRef(null);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !enabled) return;

    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-US';
    recRef.current      = rec;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();
        if (t.includes('hey zeus') || t.includes('hey zues') || t === 'zeus') {
          rec.stop();
          onWake?.();
          break;
        }
      }
    };

    rec.onend = () => {
      if (enabled && recRef.current === rec) {
        timerRef.current = setTimeout(start, 800);
      }
    };

    rec.onerror = (ev) => {
      if (ev.error !== 'no-speech') {
        timerRef.current = setTimeout(start, 2000);
      }
    };

    try { rec.start(); } catch {}
  }, [enabled, onWake]);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      clearTimeout(timerRef.current);
      try { recRef.current?.stop(); } catch {}
      recRef.current = null;
    }
    return () => {
      clearTimeout(timerRef.current);
      try { recRef.current?.stop(); } catch {}
    };
  }, [enabled, start]);
}
