import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const COLS = 24;
const ROWS = 18;
const CELL = 20;
const TICK_MS = 110;

function randomFood(snake) {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

const KEY_DIRS = {
  ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
};

// Hidden Konami-code easter egg — a theme-aware Snake game rendered with whatever
// neon palette is currently active, so it never looks out of place no matter the theme.
export default function SnakeGame({ onClose }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('zeus-snake-best') || 0));
  const [gameOver, setGameOver] = useState(false);

  const reset = () => {
    const start = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
    const snake = [start, { x: start.x - 1, y: start.y }, { x: start.x - 2, y: start.y }];
    stateRef.current = { snake, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, food: randomFood(snake) };
    setScore(0);
    setGameOver(false);
  };

  useEffect(() => { reset(); }, []);

  // Keyboard controls — Esc exits, Enter/Space restarts after game over
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (gameOver) {
        if (e.key === 'Enter' || e.key === ' ') reset();
        return;
      }
      const nd = KEY_DIRS[e.key];
      if (!nd) return;
      e.preventDefault();
      const s = stateRef.current;
      if (!s) return;
      // disallow reversing straight into your own body
      if (s.snake.length > 1 && nd.x === -s.dir.x && nd.y === -s.dir.y) return;
      s.nextDir = nd;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameOver, onClose]);

  // Render + tick loop, themed off the live CSS variables
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
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = border;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke(); }
      for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke(); }
      ctx.globalAlpha = 1;

      ctx.shadowColor = accent2;
      ctx.shadowBlur = 12;
      ctx.fillStyle = accent2;
      ctx.fillRect(s.food.x * CELL + 3, s.food.y * CELL + 3, CELL - 6, CELL - 6);

      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.fillStyle = accent;
      s.snake.forEach((seg, i) => {
        ctx.globalAlpha = i === 0 ? 1 : 0.85;
        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    draw();
    if (gameOver) return;

    const tick = () => {
      const s = stateRef.current;
      if (!s) return;
      s.dir = s.nextDir;
      const head = s.snake[0];
      const newHead = { x: head.x + s.dir.x, y: head.y + s.dir.y };

      const hitWall = newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS;
      const hitSelf = s.snake.some(seg => seg.x === newHead.x && seg.y === newHead.y);
      if (hitWall || hitSelf) {
        setGameOver(true);
        setScore(prev => {
          if (prev > best) { setBest(prev); localStorage.setItem('zeus-snake-best', String(prev)); }
          return prev;
        });
        return;
      }

      s.snake.unshift(newHead);
      if (newHead.x === s.food.x && newHead.y === s.food.y) {
        setScore(prev => prev + 1);
        s.food = randomFood(s.snake);
      } else {
        s.snake.pop();
      }
      draw();
    };

    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [gameOver, best]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-between" style={{ width: COLS * CELL }}>
          <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: 12, letterSpacing: '0.12em' }}>
            ⚡ ZEUS SNAKE
          </span>
          <span style={{ color: 'var(--c-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            SCORE {score} · BEST {best}
          </span>
        </div>
        <div style={{ position: 'relative', border: '1px solid var(--c-border-hi)', boxShadow: '0 0 40px var(--c-glow)', lineHeight: 0 }}>
          <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL} />
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: 16 }}>GAME OVER</span>
              <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Press Enter to retry</span>
            </div>
          )}
        </div>
        <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>
          Arrows / WASD to move · Esc to exit
        </span>
      </div>
    </motion.div>
  );
}
