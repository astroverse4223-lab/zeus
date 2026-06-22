import React, { useEffect, useRef, useState, useCallback } from 'react';
import useStore from '../../store/useStore.js';
import FloatingPanel from '../FloatingPanel.jsx';

const COLS = 10, ROWS = 20, CELL = 24;

const PIECES = {
  I: { color: '#00d4ff', rotations: [
    [[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]],
  ] },
  J: { color: '#3366ff', rotations: [
    [[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[1,2],[0,2]],
  ] },
  L: { color: '#ff9900', rotations: [
    [[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]],
  ] },
  O: { color: '#ffd500', rotations: [
    [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]],
  ] },
  S: { color: '#00ff88', rotations: [
    [[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]],
  ] },
  T: { color: '#a855f7', rotations: [
    [[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]],
  ] },
  Z: { color: '#ff3366', rotations: [
    [[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]],
  ] },
};
const TYPES = Object.keys(PIECES);

function emptyBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
function randomType() { return TYPES[Math.floor(Math.random() * TYPES.length)]; }
function cellsFor(type, rot, x, y) {
  return PIECES[type].rotations[rot].map(([cx, cy]) => [cx + x, cy + y]);
}
function collides(board, cells) {
  return cells.some(([x, y]) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x]));
}

export default function TetrisGame({ onClose }) {
  const assistantName = useStore(s => (s.settings?.assistantName || 'ZEUS').toUpperCase());
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const drawRef = useRef(() => {});
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('zeus-tetris-best') || 0));
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [next, setNext] = useState('I');
  const [over, setOver] = useState(false);

  const spawn = useCallback((board) => {
    const type = stateRef.current?.nextType || randomType();
    const nextType = randomType();
    setNext(nextType);
    const piece = { type, rot: 0, x: 3, y: -1 };
    if (collides(board, cellsFor(piece.type, piece.rot, piece.x, piece.y + 1))) {
      // still allow if just spawning overlaps top buffer
    }
    return { piece, nextType };
  }, []);

  const reset = useCallback(() => {
    const board = emptyBoard();
    const { piece, nextType } = spawn(board);
    stateRef.current = { board, piece, nextType, dropAcc: 0 };
    setScore(0); setLines(0); setLevel(1); setOver(false);
  }, [spawn]);

  useEffect(() => { reset(); }, [reset]);

  const lockPiece = useCallback(() => {
    const s = stateRef.current;
    const cells = cellsFor(s.piece.type, s.piece.rot, s.piece.x, s.piece.y);
    if (cells.some(([, y]) => y < 0)) { setOver(true); return; }
    cells.forEach(([x, y]) => { if (y >= 0) s.board[y][x] = PIECES[s.piece.type].color; });

    let cleared = 0;
    s.board = s.board.filter(row => {
      const full = row.every(c => c);
      if (full) cleared++;
      return !full;
    });
    while (s.board.length < ROWS) s.board.unshift(Array(COLS).fill(null));

    if (cleared) {
      const points = [0, 100, 300, 500, 800][cleared] || 800;
      setScore(prev => {
        const next = prev + points * level;
        if (next > best) { setBest(next); localStorage.setItem('zeus-tetris-best', String(next)); }
        return next;
      });
      setLines(prev => {
        const total = prev + cleared;
        setLevel(1 + Math.floor(total / 10));
        return total;
      });
    }

    const type = s.nextType;
    const nextType = randomType();
    setNext(nextType);
    s.piece = { type, rot: 0, x: 3, y: -1 };
    s.nextType = nextType;
    if (collides(s.board, cellsFor(s.piece.type, s.piece.rot, s.piece.x, s.piece.y))) setOver(true);
  }, [best, level]);

  const tryMove = useCallback((dx, dy) => {
    const s = stateRef.current;
    if (!s || over) return false;
    const moved = { ...s.piece, x: s.piece.x + dx, y: s.piece.y + dy };
    if (collides(s.board, cellsFor(moved.type, moved.rot, moved.x, moved.y))) return false;
    s.piece = moved;
    return true;
  }, [over]);

  const tryRotate = useCallback(() => {
    const s = stateRef.current;
    if (!s || over) return;
    const rot = (s.piece.rot + 1) % 4;
    for (const kick of [0, -1, 1, -2, 2]) {
      const candidate = { ...s.piece, rot, x: s.piece.x + kick };
      if (!collides(s.board, cellsFor(candidate.type, candidate.rot, candidate.x, candidate.y))) {
        s.piece = candidate;
        return;
      }
    }
  }, [over]);

  const hardDrop = useCallback(() => {
    const s = stateRef.current;
    if (!s || over) return;
    while (tryMove(0, 1)) {}
    lockPiece();
  }, [tryMove, lockPiece, over]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (over) { if (e.key === 'Enter') reset(); return; }
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': tryMove(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': tryMove(1, 0); break;
        case 'ArrowDown': case 's': case 'S': if (!tryMove(0, 1)) lockPiece(); break;
        case 'ArrowUp': case 'w': case 'W': tryRotate(); break;
        case ' ': hardDrop(); break;
        default: return;
      }
      e.preventDefault();
      drawRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [over, onClose, reset, tryMove, tryRotate, hardDrop, lockPiece]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--c-bg').trim() || '#080c14';
    const border = styles.getPropertyValue('--c-border').trim() || '#1a2a4a';

    const draw = () => {
      const s = stateRef.current;
      if (!s) return;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = border;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke(); }
      for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke(); }
      ctx.globalAlpha = 1;

      s.board.forEach((row, y) => row.forEach((color, x) => {
        if (!color) return;
        ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.fillStyle = color;
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      }));

      // ghost piece
      let ghost = { ...s.piece };
      while (!collides(s.board, cellsFor(ghost.type, ghost.rot, ghost.x, ghost.y + 1))) ghost.y++;
      ctx.globalAlpha = 0.18;
      cellsFor(ghost.type, ghost.rot, ghost.x, ghost.y).forEach(([x, y]) => {
        if (y < 0) return;
        ctx.fillStyle = PIECES[ghost.type].color;
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      });
      ctx.globalAlpha = 1;

      const color = PIECES[s.piece.type].color;
      ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fillStyle = color;
      cellsFor(s.piece.type, s.piece.rot, s.piece.x, s.piece.y).forEach(([x, y]) => {
        if (y < 0) return;
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      });
      ctx.shadowBlur = 0;
    };

    drawRef.current = draw;
    draw();
    if (over) return;

    const tickMs = Math.max(120, 800 - (level - 1) * 60);
    const interval = setInterval(() => {
      if (!tryMove(0, 1)) lockPiece();
      draw();
    }, tickMs);
    return () => clearInterval(interval);
  }, [over, level, tryMove, lockPiece]);

  return (
    <FloatingPanel
      id="tetris-game" title={`${assistantName} TETRIS`} onClose={onClose} resizable={false}
      defaultWidth={COLS * CELL + 180} defaultHeight={ROWS * CELL + 120}
      icon={<span style={{ fontSize: 14 }}>⚡</span>}
      headerExtra={
        <>
          <span style={{ color: 'var(--c-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            SCORE {score} · BEST {best}
          </span>
          <div className="flex-1" />
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-3">
        <div className="flex items-start gap-3">
          <div style={{ position: 'relative', border: '1px solid var(--c-border-hi)', boxShadow: '0 0 40px var(--c-glow)', lineHeight: 0 }}>
            <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL} />
            {over && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.7)' }}>
                <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: 16 }}>GAME OVER</span>
                <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Press Enter to retry</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3" style={{ width: 120 }}>
            <div className="rounded-lg p-2" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
              <div style={{ color: 'var(--c-muted)', fontSize: 9, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', marginBottom: 4 }}>NEXT</div>
              <div className="flex items-center justify-center" style={{ height: 48 }}>
                <NextPreview type={next} />
              </div>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
              <div style={{ color: 'var(--c-muted)', fontSize: 9, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>LEVEL</div>
              <div style={{ color: 'var(--c-accent)', fontSize: 16, fontFamily: 'JetBrains Mono, monospace' }}>{level}</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
              <div style={{ color: 'var(--c-muted)', fontSize: 9, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>LINES</div>
              <div style={{ color: 'var(--c-accent)', fontSize: 16, fontFamily: 'JetBrains Mono, monospace' }}>{lines}</div>
            </div>
          </div>
        </div>
        <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>
          Arrows/WASD move/rotate · Space hard drop · Esc to exit
        </span>
      </div>
    </FloatingPanel>
  );
}

function NextPreview({ type }) {
  const cells = PIECES[type].rotations[0];
  const color = PIECES[type].color;
  const size = 10;
  return (
    <svg width={size * 4} height={size * 4}>
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * size} y={y * size} width={size - 1} height={size - 1} fill={color} />
      ))}
    </svg>
  );
}
