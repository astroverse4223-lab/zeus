import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useStore from '../store/useStore.js';

const LANGUAGES = [
  { id: 'auto',       label: 'Auto-detect', hint: '🔍' },
  { id: 'JavaScript', label: 'JavaScript',  hint: 'JS'  },
  { id: 'TypeScript', label: 'TypeScript',  hint: 'TS'  },
  { id: 'Python',     label: 'Python',      hint: 'PY'  },
  { id: 'Rust',       label: 'Rust',        hint: 'RS'  },
  { id: 'Go',         label: 'Go',          hint: 'GO'  },
  { id: 'Java',       label: 'Java',        hint: 'JV'  },
  { id: 'C++',        label: 'C++',         hint: 'C++' },
  { id: 'C#',         label: 'C#',          hint: 'C#'  },
];

function buildAgentPrompt(task, directory, language) {
  const langLine = language !== 'auto' ? `\nLanguage/Framework: ${language}` : '';
  return `[ZEUS CODING AGENT — ACTIVATED]

Task: ${task}
Working Directory: ${directory}${langLine}

The working directory snapshot is attached. Call write_file for the first file RIGHT NOW — no text output, no plans, no descriptions. Text does not save files. Only write_file tool calls save files. Write every file completely, then call task_complete.`;
}

export default function AgentLauncher({ onLaunch, onClose }) {
  const rememberedDir = useStore(s => s.agentDir);
  const [task, setTask]         = useState('');
  const [directory, setDirectory] = useState(rememberedDir || '');
  const [language, setLanguage] = useState('auto');
  const [browsing, setBrowsing] = useState(false);

  // A directory is all that's required — the task is optional. With just a directory we
  // turn on sticky agent mode and you type tasks in the normal input bar; with a task we
  // also kick off the first job immediately.
  const canLaunch = directory.trim().length > 0;

  const browseDir = async () => {
    setBrowsing(true);
    try {
      const dir = await window.zeus?.pickDirectory();
      if (dir) setDirectory(dir);
    } finally {
      setBrowsing(false);
    }
  };

  const launch = () => {
    if (!canLaunch) return;
    const dir = directory.trim();
    const t = task.trim();
    onLaunch({ directory: dir, prompt: t ? buildAgentPrompt(t, dir, language) : null });
  };

  // Esc closes the modal; Ctrl/Cmd+Enter launches from anywhere in the modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); launch(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, canLaunch, task, directory, language]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 16 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border-hi)',
          boxShadow: '0 0 0 1px var(--c-border), 0 0 60px var(--c-glow), 0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: 'var(--c-card)', borderBottom: '1px solid var(--c-border)' }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl"
            style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, var(--c-accent2), var(--c-accent))',
              boxShadow: '0 0 20px var(--c-glow)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080c14" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-orbitron font-bold tracking-widest"
              style={{ color: 'var(--c-accent)', fontSize: '12px', letterSpacing: '0.15em' }}
            >
              CODING AGENT
            </p>
            <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: '1px' }}>
              AI-powered development — reads, writes, runs, fixes
            </p>
          </div>
          <button className="btn-icon w-7 h-7 flex-shrink-0" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-5">

          {/* Task */}
          <div className="flex flex-col gap-2">
            <label
              className="font-orbitron tracking-widest"
              style={{ color: 'var(--c-muted)', fontSize: '10px', letterSpacing: '0.12em' }}
            >
              FIRST TASK <span style={{ opacity: 0.6 }}>(optional)</span>
            </label>
            <textarea
              className="zeus-input w-full rounded-xl px-4 py-3"
              rows={4}
              placeholder={`Optional — describe a first task, or leave blank and just turn on agent mode...\n\nExamples:\n• Build a REST API with Express + SQLite for a todo list\n• Add dark mode toggle to this React app\n• Fix the authentication bug in auth.py`}
              value={task}
              onChange={e => setTask(e.target.value)}
              style={{ fontSize: '13px', lineHeight: 1.65, resize: 'vertical', minHeight: '110px' }}
              autoFocus
            />
          </div>

          {/* Directory */}
          <div className="flex flex-col gap-2">
            <label
              className="font-orbitron tracking-widest"
              style={{ color: 'var(--c-muted)', fontSize: '10px', letterSpacing: '0.12em' }}
            >
              PROJECT DIRECTORY *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="zeus-input flex-1 rounded-xl px-4 py-2.5"
                placeholder="C:\Users\you\projects\myapp"
                value={directory}
                onChange={e => setDirectory(e.target.value)}
                style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}
              />
              <motion.button
                className="btn-ghost rounded-xl px-4 py-2 flex-shrink-0 font-orbitron tracking-widest"
                style={{ fontSize: '10px', letterSpacing: '0.1em', opacity: browsing ? 0.5 : 1 }}
                onClick={browseDir}
                disabled={browsing}
                whileTap={{ scale: 0.95 }}
              >
                {browsing ? '...' : 'BROWSE'}
              </motion.button>
            </div>
          </div>

          {/* Language */}
          <div className="flex flex-col gap-2">
            <label
              className="font-orbitron tracking-widest"
              style={{ color: 'var(--c-muted)', fontSize: '10px', letterSpacing: '0.12em' }}
            >
              LANGUAGE / FRAMEWORK
            </label>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLanguage(l.id)}
                  className="rounded-lg transition-all"
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    cursor: 'pointer',
                    background: language === l.id ? 'var(--c-glow-hi)' : 'var(--c-card)',
                    border: `1px solid ${language === l.id ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    color: language === l.id ? 'var(--c-accent)' : 'var(--c-dim)',
                    fontWeight: language === l.id ? '600' : '400',
                  }}
                >
                  {l.hint}&nbsp;{l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info banner */}
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--c-border)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ color: 'var(--c-muted)', fontSize: '11px', lineHeight: 1.55 }}>
              Agent will map your project, read files, write code, and run commands.
              For smooth operation, disable <strong style={{ color: 'var(--c-dim)' }}>Tool Confirmation</strong> in Settings → Behavior.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="btn-ghost flex-1 rounded-xl py-3 text-sm"
              onClick={onClose}
              style={{ fontSize: '12px' }}
            >
              Cancel
            </button>
            <motion.button
              className="btn-primary flex-1 rounded-xl py-3 font-orbitron tracking-widest flex items-center justify-center gap-2"
              style={{ fontSize: '11px', letterSpacing: '0.12em', opacity: canLaunch ? 1 : 0.35, cursor: canLaunch ? 'pointer' : 'default' }}
              onClick={launch}
              disabled={!canLaunch}
              whileTap={canLaunch ? { scale: 0.97 } : {}}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              {task.trim() ? 'LAUNCH TASK' : 'ENABLE AGENT'}
            </motion.button>
          </div>

          {/* Keyboard hint */}
          <p style={{ color: 'var(--c-muted)', fontSize: '10px', textAlign: 'center', marginTop: -6 }}>
            <kbd style={{ fontFamily: 'JetBrains Mono, monospace' }}>Ctrl</kbd>+<kbd style={{ fontFamily: 'JetBrains Mono, monospace' }}>Enter</kbd> to launch · <kbd style={{ fontFamily: 'JetBrains Mono, monospace' }}>Esc</kbd> to cancel
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
