import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../store/useStore.js';

const IDLE_MS = 3 * 60 * 1000; // 3 minutes of no input
const KATAKANA = 'アカサタナハマヤラワガザダバパイキシチニヒミリヰギジヂビピウクスツヌフムユルグズブヅプエケセテネヘメレヱゲゼデベペオコソトノホモヨロヲゴゾドボポ0123456789';

// Theme-aware "Matrix rain" screensaver that kicks in after a few idle minutes —
// dismissed by any mouse/keyboard input. Never activates mid-stream so it can't
// obscure an in-progress agent run.
export default function IdleScreensaver() {
  const [active, setActive] = useState(false);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wake = () => {
      setActive(prev => (prev ? false : prev));
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!useStore.getState().streaming) setActive(true);
      }, IDLE_MS);
    };
    wake();
    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, wake));
    return () => {
      clearTimeout(timerRef.current);
      events.forEach(ev => window.removeEventListener(ev, wake));
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || '#00d4ff';
    const fontSize = 16;
    const cols = Math.ceil(canvas.width / fontSize);
    const drops = new Array(cols).fill(0).map(() => Math.random() * -50);

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = accent;
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = KATAKANA[Math.floor(Math.random() * KATAKANA.length)];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 40);
    return () => { clearInterval(interval); window.removeEventListener('resize', resize); };
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0"
          style={{ background: '#000', zIndex: 200, cursor: 'none' }}
        >
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
