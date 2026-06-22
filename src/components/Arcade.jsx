import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore.js';
import FloatingPanel from './FloatingPanel.jsx';
import SnakeGame from './SnakeGame.jsx';
import PongGame from './games/PongGame.jsx';
import BreakoutGame from './games/BreakoutGame.jsx';
import TetrisGame from './games/TetrisGame.jsx';
import Game2048 from './games/Game2048.jsx';

const GAMES = [
  {
    id: 'snake', title: 'SNAKE', desc: 'Grow long, don\'t bite yourself', Component: SnakeGame,
    bestKey: 'zeus-snake-best',
    icon: <><rect x="3" y="3" width="6" height="6" rx="1" /><path d="M9 6h6a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H9" /><rect x="15" y="15" width="6" height="6" rx="1" /></>,
  },
  {
    id: 'pong', title: 'PONG', desc: 'First to 7 vs the CPU', Component: PongGame,
    bestKey: null,
    icon: <><rect x="3" y="5" width="3" height="14" /><rect x="18" y="5" width="3" height="14" /><circle cx="12" cy="12" r="2" /></>,
  },
  {
    id: 'breakout', title: 'BREAKOUT', desc: 'Clear every brick', Component: BreakoutGame,
    bestKey: 'zeus-breakout-best',
    icon: <><rect x="3" y="4" width="18" height="6" rx="1" /><rect x="9" y="17" width="6" height="3" rx="1" /><circle cx="12" cy="13" r="1.5" /></>,
  },
  {
    id: 'tetris', title: 'TETRIS', desc: 'Stack lines, don\'t top out', Component: TetrisGame,
    bestKey: 'zeus-tetris-best',
    icon: <><rect x="3" y="3" width="6" height="6" /><rect x="9" y="3" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /><rect x="15" y="9" width="6" height="6" /></>,
  },
  {
    id: '2048', title: '2048', desc: 'Merge tiles to the target', Component: Game2048,
    bestKey: 'zeus-2048-best',
    icon: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></>,
  },
];

function GameTile({ game, onPlay }) {
  const best = game.bestKey ? Number(localStorage.getItem(game.bestKey) || 0) : null;
  return (
    <button
      onClick={() => onPlay(game.id)}
      className="flex flex-col items-start gap-2 rounded-xl p-4 text-left"
      style={{
        background: 'var(--c-card)', border: '1px solid var(--c-border)',
        cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', width: 200,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.boxShadow = '0 0 16px var(--c-glow)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {game.icon}
      </svg>
      <span style={{ color: 'var(--c-text)', fontFamily: 'Orbitron, sans-serif', fontSize: 13, letterSpacing: '0.08em' }}>
        {game.title}
      </span>
      <span style={{ color: 'var(--c-muted)', fontSize: 11 }}>{game.desc}</span>
      {best != null && (
        <span style={{ color: 'var(--c-accent2)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
          BEST {best}
        </span>
      )}
    </button>
  );
}

export default function Arcade({ onClose }) {
  const assistantName = useStore(s => (s.settings?.assistantName || 'ZEUS').toUpperCase());
  const [active, setActive] = useState(null);

  if (active) {
    const game = GAMES.find(g => g.id === active);
    const GameComponent = game.Component;
    return <GameComponent onClose={() => setActive(null)} />;
  }

  return (
    <FloatingPanel
      id="arcade" title={`${assistantName} ARCADE`} onClose={onClose}
      defaultWidth={760} defaultHeight={560}
      icon={<span style={{ fontSize: 14 }}>🎮</span>}
      headerExtra={<div className="flex-1" />}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-4" style={{ overflowY: 'auto' }}>
        <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>
          Pick a game — classic arcade for when things get slow
        </span>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-stretch justify-center gap-3"
          >
            {GAMES.map(game => <GameTile key={game.id} game={game} onPlay={setActive} />)}
          </motion.div>
        </AnimatePresence>
        <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>
          Esc inside any game returns you here
        </span>
      </div>
    </FloatingPanel>
  );
}
