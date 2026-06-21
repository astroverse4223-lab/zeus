import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import useStore from '../store/useStore.js';

// Strip ANSI escape codes
const stripAnsi = str => str.replace(/\x1B\[[0-9;]*[mGKHFJABCDsuhl]/g, '').replace(/\x1B\][^\x07]*\x07/g, '');

// Dim the path: show last 2 segments, replace homedir with ~
function shortPath(full) {
  if (!full) return '~';
  const home = full.replace(/\\/g, '/').toLowerCase();
  const normalized = full.replace(/\\/g, '/');
  // Replace home dir with ~
  const homeSegments = (window.__zeusHome || '').replace(/\\/g, '/');
  let display = homeSegments && normalized.toLowerCase().startsWith(homeSegments.toLowerCase())
    ? '~' + normalized.slice(homeSegments.length)
    : normalized;
  // Cap at last 2 path segments for readability
  const parts = display.replace(/^~/, '').split('/').filter(Boolean);
  if (parts.length > 2) display = '~' + '/…/' + parts.slice(-2).join('/');
  return display || '~';
}

function OutputLine({ line }) {
  const isError    = line.type === 'stderr';
  const isInfo     = line.type === 'info';
  const isCmd      = line.type === 'cmd';
  const isZeusCmd  = line.type === 'zeus-cmd';
  const isZeusTool = line.type === 'zeus-tool';

  // User command echo
  if (isCmd) {
    return (
      <div className="flex items-start gap-1" style={{ marginBottom: '2px', marginTop: '4px' }}>
        <span style={{ color: 'var(--c-green)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', userSelect: 'none', flexShrink: 0 }}>
          {line.prompt}&gt;
        </span>
        <span style={{ color: 'var(--c-accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
          {line.text}
        </span>
      </div>
    );
  }

  // Zeus running a shell command
  if (isZeusCmd) {
    return (
      <div className="flex items-start gap-1" style={{ marginBottom: '2px', marginTop: '6px' }}>
        <span style={{
          color: 'var(--c-purple)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
          userSelect: 'none', flexShrink: 0,
        }}>
          zeus&gt;
        </span>
        <span style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
          {line.text}
        </span>
      </div>
    );
  }

  // Zeus tool activity summary
  if (isZeusTool) {
    return (
      <div style={{
        color: 'var(--c-accent)', opacity: 0.75,
        fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
        marginBottom: '1px', paddingLeft: '2px',
        whiteSpace: 'pre',
      }}>
        ◆ {line.text}
      </div>
    );
  }

  return (
    <div style={{
      color: isError ? 'var(--c-red)' : isInfo ? 'var(--c-muted)' : '#c8d3e0',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      marginBottom: '1px',
    }}>
      {line.text}
    </div>
  );
}

export default function Terminal({ onClose }) {
  const assistantName = useStore(s => s.settings?.assistantName || 'Zeus');
  const [lines, setLines]   = useState([]);
  const [input, setInput]   = useState('');
  const [cwd, setCwd]       = useState('');
  const [busy, setBusy]     = useState(false);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Load initial cwd
  useEffect(() => {
    window.zeus?.terminalCwd().then(c => { setCwd(c); window.__zeusHome = c; }).catch(() => {});
    inputRef.current?.focus();
  }, []);

  // Zeus tool activity feed
  useEffect(() => {
    if (!window.zeus?.onTerminalLog) return;
    const unsub = window.zeus.onTerminalLog(({ lines }) => {
      setLines(prev => [...prev, ...lines]);
    });
    return unsub;
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const addLines = (entries) => setLines(prev => [...prev, ...entries]);

  const runCommand = useCallback(async (cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // Add to history
    setHistory(prev => [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 100));
    setHistIdx(-1);

    // Handle built-in clear
    if (trimmed === 'clear' || trimmed === 'cls') {
      setLines([]);
      return;
    }

    addLines([{ type: 'cmd', prompt: shortPath(cwd), text: trimmed }]);
    setBusy(true);

    try {
      const res = await window.zeus?.terminalExec(trimmed);
      const newCwd = res?.cwd || cwd;
      setCwd(newCwd);

      const outLines = [];
      if (res?.stdout) {
        stripAnsi(res.stdout).split('\n').forEach(l => {
          if (l.trim() || outLines.length > 0) outLines.push({ type: 'stdout', text: l });
        });
        // Trim trailing blank lines
        while (outLines.length && !outLines[outLines.length - 1].text.trim()) outLines.pop();
      }
      if (res?.stderr) {
        stripAnsi(res.stderr).split('\n').forEach(l => {
          if (l) outLines.push({ type: 'stderr', text: l });
        });
      }
      if (res?.exitCode !== 0 && res?.exitCode !== undefined && !res?.stderr) {
        outLines.push({ type: 'info', text: `exit ${res.exitCode}` });
      }
      if (outLines.length) addLines(outLines);
    } catch (err) {
      addLines([{ type: 'stderr', text: err.message }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [cwd]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!busy) { runCommand(input); setInput(''); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? '' : (history[next] ?? ''));
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 280, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        background: '#0a0c10',
        borderTop: '1px solid var(--c-border)',
        borderBottom: '1px solid var(--c-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{
          height: '32px',
          background: '#080c14',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        {/* Terminal icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-green)" strokeWidth="2" strokeLinecap="round">
          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        <span style={{ color: 'var(--c-green)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>
          TERMINAL
        </span>
        <span style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', marginLeft: '4px' }}>
          {shortPath(cwd)}
        </span>

        {busy && (
          <div className="flex gap-0.5 ml-1">
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 3, height: 3, borderRadius: '50%', background: 'var(--c-green)',
                animation: `blink 0.8s ${i * 0.15}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        )}

        <div className="flex-1" />

        <button
          className="btn-icon"
          style={{ fontSize: '9px', padding: '2px 6px', color: 'var(--c-muted)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}
          onClick={() => setLines([])}
          title="Clear (Ctrl+L)"
        >
          CLEAR
        </button>

        <button className="btn-icon w-5 h-5" onClick={onClose} title="Close terminal">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Output */}
      <div
        className="flex-1 overflow-y-auto px-3 pt-2 pb-1 selectable"
        style={{ scrollbarWidth: 'thin' }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.length === 0 && (
          <div style={{ color: 'var(--c-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', padding: '8px 0' }}>
            {assistantName} terminal — type a command and press Enter. Ctrl+L to clear.
          </div>
        )}
        {lines.map((line, i) => <OutputLine key={i} line={line} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{
          height: '36px',
          borderTop: '1px solid var(--c-border)',
          background: '#080c14',
        }}
      >
        <span style={{ color: 'var(--c-green)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', flexShrink: 0, userSelect: 'none' }}>
          {shortPath(cwd)}&gt;
        </span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none"
          style={{
            color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
            border: 'none', caretColor: 'var(--c-green)',
          }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          placeholder={busy ? 'running…' : ''}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        {busy && (
          <span style={{ color: 'var(--c-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', flexShrink: 0 }}>
            running…
          </span>
        )}
      </div>
    </motion.div>
  );
}
