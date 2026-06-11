import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Per-kind presentation ──────────────────────────────────────────────────────
const KIND = {
  create: { label: 'created',  sign: '+', color: 'var(--c-green)',  icon: 'M12 5v14M5 12h14' },
  modify: { label: 'modified', sign: '~', color: 'var(--c-yellow)', icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z' },
  delete: { label: 'deleted',  sign: '−', color: 'var(--c-red)',    icon: 'M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6' },
  mkdir:  { label: 'new folder', sign: '+', color: 'var(--c-green)', icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  rmdir:  { label: 'folder removed', sign: '−', color: 'var(--c-red)', icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  move:   { label: 'moved',    sign: '→', color: 'var(--c-accent)',  icon: 'M5 12h14M12 5l7 7-7 7' },
};

const baseName = p => (p || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop();
const dirName  = p => { const parts = (p || '').replace(/[\\/]+$/, '').split(/[\\/]/); return parts.slice(0, -1).join('\\'); };

// Compact LCS line diff — capped to keep it fast on large files.
function lineDiff(before = '', after = '') {
  const CAP = 500;
  const a = (before || '').split('\n').slice(0, CAP);
  const b = (after  || '').split('\n').slice(0, CAP);
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ t: 'ctx', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', text: a[i++] }); }
    else { out.push({ t: 'add', text: b[j++] }); }
  }
  while (i < m) out.push({ t: 'del', text: a[i++] });
  while (j < n) out.push({ t: 'add', text: b[j++] });
  return out;
}

const ROW_BG = { add: 'rgba(0,255,136,0.08)', del: 'rgba(255,51,102,0.08)', ctx: 'transparent' };
const ROW_FG = { add: '#9affc9', del: '#ff8aa3', ctx: 'var(--c-dim)' };
const ROW_GUTTER = { add: '+', del: '−', ctx: ' ' };

function DiffView({ diff }) {
  let added = 0, removed = 0;
  diff.forEach(d => { if (d.t === 'add') added++; else if (d.t === 'del') removed++; });
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 4, fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
        <span style={{ color: 'var(--c-green)' }}>+{added}</span>
        <span style={{ color: 'var(--c-red)' }}>−{removed}</span>
      </div>
      <pre style={{
        margin: 0, maxHeight: 260, overflow: 'auto', borderRadius: 6,
        border: '1px solid var(--c-border)', background: 'rgba(0,0,0,0.35)',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', lineHeight: 1.5,
      }}>
        {diff.map((d, i) => (
          <div key={i} style={{ background: ROW_BG[d.t], color: ROW_FG[d.t], display: 'flex', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <span style={{ width: 14, flexShrink: 0, textAlign: 'center', opacity: 0.6, userSelect: 'none' }}>{ROW_GUTTER[d.t]}</span>
            <span style={{ flex: 1, paddingRight: 8 }}>{d.text || ' '}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

function ChangeRow({ change }) {
  const [expanded, setExpanded] = useState(false);
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [undone, setUndone] = useState(false);
  const [busy, setBusy] = useState(false);

  const k = KIND[change.kind] || KIND.modify;
  const canDiff = change.kind === 'create' || change.kind === 'modify' || change.kind === 'delete';
  const canUndo = !undone && !!window.zeus?.undoFileChange;

  const toggle = async () => {
    if (!canDiff) return;
    const next = !expanded;
    setExpanded(next);
    if (next && !diff) {
      setLoading(true);
      try {
        const d = await window.zeus?.getFileChangeDiff(change.id);
        if (d) setDiff(lineDiff(d.before || '', d.after || ''));
      } finally { setLoading(false); }
    }
  };

  const undo = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const r = await window.zeus?.undoFileChange(change.id);
      if (r?.ok) setUndone(true);
      else if (r?.error) alert(`Undo failed: ${r.error}`);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ borderTop: '1px solid var(--c-border)' }}>
      <div
        className="flex items-center gap-2 px-2 py-1.5"
        style={{ cursor: canDiff ? 'pointer' : 'default', opacity: undone ? 0.5 : 1 }}
        onClick={toggle}
      >
        <span style={{ color: k.color, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', width: 10, textAlign: 'center', flexShrink: 0 }}>{k.sign}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d={k.icon} />
        </svg>
        <span style={{ color: 'var(--c-text)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textDecoration: undone ? 'line-through' : 'none' }}>
          {change.kind === 'move' ? `${baseName(change.from)} → ${baseName(change.to)}` : baseName(change.path)}
        </span>
        <span style={{ color: 'var(--c-muted)', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace' }} className="truncate flex-1">
          {dirName(change.path)}
        </span>
        {undone && <span style={{ color: 'var(--c-muted)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif' }}>UNDONE</span>}
        {canUndo && (
          <button
            onClick={undo}
            disabled={busy}
            className="btn-icon"
            style={{ fontSize: '9px', padding: '1px 7px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em', color: 'var(--c-muted)', border: '1px solid var(--c-border)', borderRadius: 4, flexShrink: 0 }}
            title="Revert this change on disk"
          >
            {busy ? '…' : 'UNDO'}
          </button>
        )}
        {canDiff && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--c-muted)', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : '' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-2 pb-2">
              {loading ? (
                <span style={{ color: 'var(--c-muted)', fontSize: '10px' }}>Loading diff…</span>
              ) : diff ? (
                <DiffView diff={diff} />
              ) : (
                <span style={{ color: 'var(--c-muted)', fontSize: '10px' }}>No diff available.</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FileChanges({ changes }) {
  const [open, setOpen] = useState(true);
  if (!changes?.length) return null;

  return (
    <div
      className="w-full rounded-lg my-1 overflow-hidden"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
    >
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer"
        onClick={() => setOpen(o => !o)}
        style={{ background: 'rgba(168,85,247,0.06)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
        <span style={{ color: 'var(--c-purple)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
          FILES CHANGED
        </span>
        <span style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
          {changes.length}
        </span>
        <div className="flex-1" />
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'var(--c-muted)', transform: open ? 'rotate(180deg)' : '' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && changes.map((c, i) => <ChangeRow key={c.id || i} change={c} />)}
    </div>
  );
}
