import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Orb from './Orb.jsx';

const LINES = [
  'INITIALIZING NEURAL CORE',
  'LOADING AI PROVIDERS',
  'MOUNTING SYSTEM TOOLS',
  'CALIBRATING VOICE MATRIX',
  'ALL SYSTEMS ONLINE',
];

export default function BootSequence({ onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [];
    LINES.forEach((_, i) => timers.push(setTimeout(() => setStep(i + 1), 280 + i * 240)));
    timers.push(setTimeout(() => onDone?.(), 280 + LINES.length * 240 + 500));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(circle at 50% 45%, #0a1322 0%, #04060c 70%)', cursor: 'pointer' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onClick={() => onDone?.()}
      title="Click to skip"
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <Orb size={140} active speaking={step >= LINES.length} />
      </motion.div>

      <motion.h1
        className="font-orbitron font-bold glow-text"
        style={{ color: 'var(--c-accent)', fontSize: 40, letterSpacing: '0.4em', marginTop: 28, marginLeft: '0.4em' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        ZEUS
      </motion.h1>

      <div style={{ height: 96, marginTop: 18, width: 280 }}>
        {LINES.slice(0, step).map((l, i) => (
          <motion.div
            key={l}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
            style={{ marginBottom: 4 }}
          >
            <span style={{ color: i === LINES.length - 1 ? 'var(--c-green)' : 'var(--c-accent)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              {i === LINES.length - 1 ? '✓' : '›'}
            </span>
            <span style={{
              color: i === LINES.length - 1 ? 'var(--c-green)' : 'var(--c-dim)',
              fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.12em',
            }}>
              {l}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
