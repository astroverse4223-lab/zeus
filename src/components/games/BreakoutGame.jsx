import React, { useEffect, useRef, useState } from 'react';
import useStore from '../../store/useStore.js';
import FloatingPanel from '../FloatingPanel.jsx';

const W = 480, H = 560;
const PADDLE_W = 80, PADDLE_H = 12;
const BALL_SIZE = 8;
const COLS = 8, ROWS = 5;
const BRICK_W = W / COLS;
const BRICK_H = 20;
const BRICK_TOP = 50;

function makeBricks() {
  const bricks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bricks.push({ x: c * BRICK_W, y: BRICK_TOP + r * BRICK_H, row: r, alive: true });
    }
  }
  return bricks;
}

const ROW_COLORS = ['#ff3366', '#ffd500', '#00ff88', '#00d4ff', '#a855f7'];

export default function BreakoutGame({ onClose }) {
  const assistantName = useStore(s => (s.settings?.assistantName || 'ZEUS').toUpperCase());
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const keysRef = useRef({});
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('zeus-breakout-best') || 0));
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState(null); // 'won' | 'lost' | null

  const reset = () => {
    stateRef.current = {
      paddle: W / 2 - PADDLE_W / 2,
      ball: { x: W / 2, y: H - 60, vx: 3.2, vy: -4 },
      bricks: makeBricks(),
    };
    setScore(0);
    setLives(3);
    setStatus(null);
  };

  useEffect(() => { reset(); }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (status && (e.key === 'Enter' || e.key === ' ')) { reset(); return; }
      keysRef.current[e.key] = true;
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) e.preventDefault();
    };
    const onKeyUp = (e) => { keysRef.current[e.key] = false; };
    const onMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const s = stateRef.current;
      if (s) s.paddle = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMove);
    };
  }, [status, onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--c-accent').trim() || '#00d4ff';
    const bg = styles.getPropertyValue('--c-bg').trim() || '#080c14';
    const border = styles.getPropertyValue('--c-border').trim() || '#1a2a4a';

    const draw = () => {
      const s = stateRef.current;
      if (!s) return;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      s.bricks.forEach(b => {
        if (!b.alive) return;
        ctx.shadowColor = ROW_COLORS[b.row % ROW_COLORS.length];
        ctx.shadowBlur = 6;
        ctx.fillStyle = ROW_COLORS[b.row % ROW_COLORS.length];
        ctx.fillRect(b.x + 2, b.y + 2, BRICK_W - 4, BRICK_H - 4);
      });
      ctx.shadowBlur = 0;

      ctx.strokeStyle = border;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      ctx.shadowColor = accent; ctx.shadowBlur = 10; ctx.fillStyle = accent;
      ctx.fillRect(s.paddle, H - 30, PADDLE_W, PADDLE_H);

      ctx.shadowColor = '#fff'; ctx.fillStyle = '#fff';
      ctx.fillRect(s.ball.x - BALL_SIZE / 2, s.ball.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
      ctx.shadowBlur = 0;
    };

    draw();
    if (status) return;

    const tick = () => {
      const s = stateRef.current;
      if (!s) return;
      const k = keysRef.current;
      const speed = 7;
      if (k.ArrowLeft || k.a || k.A) s.paddle -= speed;
      if (k.ArrowRight || k.d || k.D) s.paddle += speed;
      s.paddle = Math.max(0, Math.min(W - PADDLE_W, s.paddle));

      s.ball.x += s.ball.vx;
      s.ball.y += s.ball.vy;

      if (s.ball.x <= BALL_SIZE / 2 || s.ball.x >= W - BALL_SIZE / 2) s.ball.vx *= -1;
      if (s.ball.y <= BALL_SIZE / 2) s.ball.vy *= -1;

      if (s.ball.y + BALL_SIZE / 2 >= H - 30 && s.ball.y + BALL_SIZE / 2 <= H - 18 &&
          s.ball.x >= s.paddle && s.ball.x <= s.paddle + PADDLE_W && s.ball.vy > 0) {
        s.ball.vy *= -1;
        s.ball.vx += (s.ball.x - (s.paddle + PADDLE_W / 2)) * 0.06;
      }

      for (const b of s.bricks) {
        if (!b.alive) continue;
        if (s.ball.x + BALL_SIZE / 2 > b.x && s.ball.x - BALL_SIZE / 2 < b.x + BRICK_W &&
            s.ball.y + BALL_SIZE / 2 > b.y && s.ball.y - BALL_SIZE / 2 < b.y + BRICK_H) {
          b.alive = false;
          s.ball.vy *= -1;
          setScore(prev => {
            const next = prev + 10;
            if (next > best) { setBest(next); localStorage.setItem('zeus-breakout-best', String(next)); }
            return next;
          });
          break;
        }
      }

      if (s.bricks.every(b => !b.alive)) { setStatus('won'); return; }

      if (s.ball.y > H) {
        setLives(prev => {
          const next = prev - 1;
          if (next <= 0) { setStatus('lost'); return 0; }
          s.ball = { x: W / 2, y: H - 60, vx: 3.2, vy: -4 };
          return next;
        });
        return;
      }

      draw();
    };

    const interval = setInterval(tick, 16);
    return () => clearInterval(interval);
  }, [status, best]);

  return (
    <FloatingPanel
      id="breakout-game" title={`${assistantName} BREAKOUT`} onClose={onClose} resizable={false}
      defaultWidth={W + 40} defaultHeight={H + 120}
      icon={<span style={{ fontSize: 14 }}>⚡</span>}
      headerExtra={
        <>
          <span style={{ color: 'var(--c-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            SCORE {score} · BEST {best} · LIVES {lives}
          </span>
          <div className="flex-1" />
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-3">
        <div style={{ position: 'relative', border: '1px solid var(--c-border-hi)', boxShadow: '0 0 40px var(--c-glow)', lineHeight: 0 }}>
          <canvas ref={canvasRef} width={W} height={H} />
          {status && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: 16 }}>
                {status === 'won' ? 'ALL BRICKS CLEARED!' : 'GAME OVER'}
              </span>
              <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Press Enter to retry</span>
            </div>
          )}
        </div>
        <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>
          Arrows / AD / Mouse to move · Esc to exit
        </span>
      </div>
    </FloatingPanel>
  );
}
