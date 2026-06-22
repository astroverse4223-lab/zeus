import React, { useEffect, useRef } from 'react';
import useStore from '../store/useStore.js';

const KATAKANA = 'アカサタナハマヤラワガザダバパイキシチニヒミリヰギジヂビピウクスツヌフムユルグズブヅプエケセテネヘメレヱゲゼデベペオコソトノホモヨロヲゴゾドボポ0123456789';

// Persistent "Matrix rain" background — a Settings → Theme → Background Pattern
// option (data-pattern="matrixrain"), not a one-off effect. Sits fixed behind the
// rest of the UI (mounted before everything else in App's DOM order, so opaque
// panels like the sidebar/chat window naturally paint over it) and stays dim so
// chat text never fights it for attention.
export default function MatrixRainBackground() {
  const pattern = useStore(s => s.settings?.ui?.backgroundPattern);
  const active = pattern === 'matrixrain';
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const fontSize = 16;
    let drops = [];

    // Resizing the canvas resets its pixel buffer, but the rain columns also need
    // to grow/shrink to match — otherwise widening the window (e.g. fullscreening
    // on an ultrawide) leaves newly-exposed columns permanently blank until the
    // effect remounts (which is why toggling the setting off/on "fixed" it).
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const cols = Math.ceil(canvas.width / fontSize);
      if (cols > drops.length) {
        for (let i = drops.length; i < cols; i++) drops.push(Math.random() * -50);
      } else {
        drops.length = cols;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0,255,65,0.55)';
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = KATAKANA[Math.floor(Math.random() * KATAKANA.length)];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    return () => { clearInterval(interval); window.removeEventListener('resize', resize); };
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', display: 'block', background: '#000' }}
    />
  );
}
