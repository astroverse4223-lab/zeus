import React, { useEffect, useRef, useState, useCallback } from 'react';
import useStore from '../../store/useStore.js';
import FloatingPanel from '../FloatingPanel.jsx';

const SIZE = 4;

const TILE_COLORS = {
  2: '#1a2a4a', 4: '#1f3a5f', 8: '#0066cc', 16: '#0080ff',
  32: '#00aaff', 64: '#00d4ff', 128: '#ffd500', 256: '#ff9900',
  512: '#ff6600', 1024: '#ff3366', 2048: '#a855f7',
};

function emptyGrid() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }

function addRandomTile(grid) {
  const empties = [];
  grid.forEach((row, y) => row.forEach((v, x) => { if (!v) empties.push([x, y]); }));
  if (!empties.length) return grid;
  const [x, y] = empties[Math.floor(Math.random() * empties.length)];
  grid[y][x] = Math.random() < 0.9 ? 2 : 4;
  return grid;
}

function cloneGrid(g) { return g.map(row => [...row]); }

// Slides+merges one row to the left; returns { row, gained, moved }
function slideRow(row) {
  const vals = row.filter(v => v);
  const merged = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      merged.push(vals[i] * 2);
      gained += vals[i] * 2;
      i++;
    } else {
      merged.push(vals[i]);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  const moved = merged.some((v, i) => v !== row[i]);
  return { row: merged, gained, moved };
}

function transpose(grid) { return grid[0].map((_, x) => grid.map(row => row[x])); }
function reverseRows(grid) { return grid.map(row => [...row].reverse()); }

function move(grid, dir) {
  // dir: 'left' | 'right' | 'up' | 'down'
  let g = cloneGrid(grid);
  let totalGain = 0;
  let anyMoved = false;

  if (dir === 'up' || dir === 'down') g = transpose(g);
  if (dir === 'right' || dir === 'down') g = reverseRows(g);

  g = g.map(row => {
    const { row: newRow, gained, moved } = slideRow(row);
    totalGain += gained;
    if (moved) anyMoved = true;
    return newRow;
  });

  if (dir === 'right' || dir === 'down') g = reverseRows(g);
  if (dir === 'up' || dir === 'down') g = transpose(g);

  return { grid: g, gained: totalGain, moved: anyMoved };
}

function canMove(grid) {
  for (const dir of ['left', 'right', 'up', 'down']) {
    if (move(grid, dir).moved) return true;
  }
  return false;
}

export default function Game2048({ onClose }) {
  const assistantName = useStore(s => (s.settings?.assistantName || 'ZEUS').toUpperCase());
  const [grid, setGrid] = useState(() => addRandomTile(addRandomTile(emptyGrid())));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('zeus-2048-best') || 0));
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  const reset = useCallback(() => {
    setGrid(addRandomTile(addRandomTile(emptyGrid())));
    setScore(0); setOver(false); setWon(false);
  }, []);

  const handleMove = useCallback((dir) => {
    if (over) return;
    const { grid: next, gained, moved } = move(gridRef.current, dir);
    if (!moved) return;
    addRandomTile(next);
    setGrid(next);
    if (gained) {
      setScore(prev => {
        const total = prev + gained;
        if (total > best) { setBest(total); localStorage.setItem('zeus-2048-best', String(total)); }
        return total;
      });
    }
    if (!won && next.some(row => row.some(v => v >= 2048))) setWon(true);
    if (!canMove(next)) setOver(true);
  }, [over, won, best]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (over && e.key === 'Enter') { reset(); return; }
      const dirs = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
      const dir = dirs[e.key];
      if (!dir) return;
      e.preventDefault();
      handleMove(dir);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [over, onClose, reset, handleMove]);

  const CELL = 78, GAP = 8;
  const boardSize = SIZE * CELL + (SIZE + 1) * GAP;

  return (
    <FloatingPanel
      id="2048-game" title={`${assistantName} 2048`} onClose={onClose} resizable={false}
      defaultWidth={boardSize + 40} defaultHeight={boardSize + 120}
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
        <div
          style={{
            position: 'relative', width: boardSize, height: boardSize, padding: GAP,
            background: 'var(--c-card)', border: '1px solid var(--c-border-hi)',
            boxShadow: '0 0 40px var(--c-glow)', borderRadius: 10,
            display: 'grid', gridTemplateColumns: `repeat(${SIZE}, ${CELL}px)`, gap: GAP,
          }}
        >
          {grid.map((row, y) => row.map((v, x) => (
            <div
              key={`${x}-${y}`}
              style={{
                width: CELL, height: CELL, borderRadius: 6,
                background: v ? TILE_COLORS[v] || '#ff00ff' : 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: v >= 8 ? '#fff' : 'var(--c-text)',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
                fontSize: v >= 1024 ? 18 : v >= 128 ? 20 : 24,
                boxShadow: v ? `0 0 14px ${TILE_COLORS[v] || '#ff00ff'}66` : 'none',
                transition: 'background 0.1s',
              }}
            >
              {v || ''}
            </div>
          )))}
          {(over || won) && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(0,0,0,0.75)', borderRadius: 10 }}
            >
              <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: 16 }}>
                {over ? 'GAME OVER' : '2048!'}
              </span>
              <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>
                {over ? 'Press Enter to retry' : 'Keep going for a higher score'}
              </span>
              {won && !over && (
                <button
                  onClick={() => setWon(false)}
                  className="mt-1 rounded-md px-3 py-1"
                  style={{ background: 'var(--c-accent)', color: '#080c14', fontSize: 11, fontFamily: 'Orbitron, sans-serif', border: 'none', cursor: 'pointer' }}
                >
                  KEEP PLAYING
                </button>
              )}
            </div>
          )}
        </div>
        <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>
          Arrows / WASD to slide · Esc to exit
        </span>
      </div>
    </FloatingPanel>
  );
}
