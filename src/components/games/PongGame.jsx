import React, { useEffect, useRef, useState } from 'react';
import useStore from '../../store/useStore.js';
import FloatingPanel from '../FloatingPanel.jsx';

const W = 600, H = 400;
const PADDLE_W = 10, PADDLE_H = 70;
const BALL_SIZE = 9;
const WIN_SCORE = 7;

export default function PongGame({ onClose }) {
  const assistantName = useStore(s => (s.settings?.assistantName || 'ZEUS').toUpperCase());
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({});
  const [score, setScore] = useState({ you: 0, cpu: 0 });
  const [over, setOver] = useState(null); // 'you' | 'cpu' | null

  const reset = (keepScore = true) => {
    stateRef.current = {
      ball: { x: W / 2, y: H / 2, vx: 4.5 * (Math.random() < 0.5 ? 1 : -1), vy: (Math.random() * 4 - 2) },
      you: H / 2 - PADDLE_H / 2,
      cpu: H / 2 - PADDLE_H / 2,
    };
    if (!keepScore) setScore({ you: 0, cpu: 0 });
    setOver(null);
  };

  useEffect(() => { reset(); }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (over && (e.key === 'Enter' || e.key === ' ')) { reset(false); return; }
      keysRef.current[e.key] = true;
      if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) e.preventDefault();
    };
    const onKeyUp = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [over, onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--c-accent').trim() || '#00d4ff';
    const accent2 = styles.getPropertyValue('--c-accent2').trim() || '#0066cc';
    const bg = styles.getPropertyValue('--c-bg').trim() || '#080c14';
    const border = styles.getPropertyValue('--c-border').trim() || '#1a2a4a';

    const draw = () => {
      const s = stateRef.current;
      if (!s) return;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = border;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.shadowColor = accent; ctx.shadowBlur = 10; ctx.fillStyle = accent;
      ctx.fillRect(20, s.you, PADDLE_W, PADDLE_H);
      ctx.shadowColor = accent2; ctx.fillStyle = accent2;
      ctx.fillRect(W - 30, s.cpu, PADDLE_W, PADDLE_H);

      ctx.shadowColor = '#fff'; ctx.fillStyle = '#fff';
      ctx.fillRect(s.ball.x - BALL_SIZE / 2, s.ball.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
      ctx.shadowBlur = 0;
    };

    draw();
    if (over) return;

    const tick = () => {
      const s = stateRef.current;
      if (!s) return;
      const k = keysRef.current;
      const speed = 6;
      if (k.ArrowUp || k.w || k.W) s.you -= speed;
      if (k.ArrowDown || k.s || k.S) s.you += speed;
      s.you = Math.max(0, Math.min(H - PADDLE_H, s.you));

      const cpuCenter = s.cpu + PADDLE_H / 2;
      const cpuSpeed = 4.2;
      if (cpuCenter < s.ball.y - 10) s.cpu += cpuSpeed;
      else if (cpuCenter > s.ball.y + 10) s.cpu -= cpuSpeed;
      s.cpu = Math.max(0, Math.min(H - PADDLE_H, s.cpu));

      s.ball.x += s.ball.vx;
      s.ball.y += s.ball.vy;

      if (s.ball.y <= BALL_SIZE / 2 || s.ball.y >= H - BALL_SIZE / 2) s.ball.vy *= -1;

      if (s.ball.x - BALL_SIZE / 2 <= 30 && s.ball.x - BALL_SIZE / 2 >= 18 &&
          s.ball.y >= s.you && s.ball.y <= s.you + PADDLE_H && s.ball.vx < 0) {
        s.ball.vx *= -1.07;
        s.ball.vy += (s.ball.y - (s.you + PADDLE_H / 2)) * 0.12;
      }
      if (s.ball.x + BALL_SIZE / 2 >= W - 30 && s.ball.x + BALL_SIZE / 2 <= W - 18 &&
          s.ball.y >= s.cpu && s.ball.y <= s.cpu + PADDLE_H && s.ball.vx > 0) {
        s.ball.vx *= -1.07;
        s.ball.vy += (s.ball.y - (s.cpu + PADDLE_H / 2)) * 0.12;
      }

      if (s.ball.x < 0) {
        setScore(prev => {
          const next = { ...prev, cpu: prev.cpu + 1 };
          if (next.cpu >= WIN_SCORE) setOver('cpu');
          return next;
        });
        reset(true);
        return;
      }
      if (s.ball.x > W) {
        setScore(prev => {
          const next = { ...prev, you: prev.you + 1 };
          if (next.you >= WIN_SCORE) setOver('you');
          return next;
        });
        reset(true);
        return;
      }

      draw();
    };

    const interval = setInterval(tick, 16);
    return () => clearInterval(interval);
  }, [over, score.you, score.cpu]);

  return (
    <FloatingPanel
      id="pong-game" title={`${assistantName} PONG`} onClose={onClose} resizable={false}
      defaultWidth={W + 40} defaultHeight={H + 120}
      icon={<span style={{ fontSize: 14 }}>⚡</span>}
      headerExtra={
        <>
          <span style={{ color: 'var(--c-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            YOU {score.you} · CPU {score.cpu}
          </span>
          <div className="flex-1" />
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-3">
        <div style={{ position: 'relative', border: '1px solid var(--c-border-hi)', boxShadow: '0 0 40px var(--c-glow)', lineHeight: 0 }}>
          <canvas ref={canvasRef} width={W} height={H} />
          {over && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: 16 }}>
                {over === 'you' ? 'YOU WIN!' : 'CPU WINS'}
              </span>
              <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Press Enter to play again</span>
            </div>
          )}
        </div>
        <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>
          Arrows / WS to move · Esc to exit
        </span>
      </div>
    </FloatingPanel>
  );
}
