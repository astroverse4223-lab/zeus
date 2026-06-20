import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { langFromPath } from '../lib/monaco.js';

// File-type → tiny color dot, so the tree reads at a glance.
function dotColor(name, isDir) {
  if (isDir) return 'var(--c-muted)';
  const ext = name.split('.').pop()?.toLowerCase();
  const map = {
    js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
    html: '#e34c26', css: '#2965f1', scss: '#cf649a', json: '#cbcb41',
    md: '#9ca3af', py: '#3572A5', go: '#00ADD8', rs: '#dea584',
  };
  return map[ext] || 'var(--c-dim)';
}

const GIT_STATUS_COLOR = { M: 'var(--c-accent)', A: 'var(--c-green)', D: 'var(--c-red)', U: 'var(--c-muted)' };

// One node in the file tree. Directories lazy-load their children on expand.
function TreeNode({ entry, depth, onOpenFile, onSplitFile, activePath }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (!entry.isDir) { onOpenFile(entry); return; }
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (children === null) {
      setLoading(true);
      const res = await window.zeus?.editorListDir(entry.path);
      setChildren(Array.isArray(res) ? res : []);
      setLoading(false);
    }
  }, [entry, expanded, children, onOpenFile]);

  const isActive = !entry.isDir && entry.path === activePath;

  return (
    <div>
      <div
        onClick={toggle}
        onContextMenu={(e) => { e.preventDefault(); if (!entry.isDir) onSplitFile(entry); }}
        className="flex items-center gap-1.5 cursor-pointer select-none"
        style={{
          padding: '3px 8px', paddingLeft: 8 + depth * 12,
          fontSize: 12.5, color: isActive ? 'var(--c-accent)' : 'var(--c-text)',
          background: isActive ? 'rgba(0,212,255,0.10)' : 'transparent',
          borderRadius: 4, transition: 'background 0.1s',
        }}
        title={entry.isDir ? undefined : 'Click to open · Right-click to open in split'}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--c-glow)'; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        {entry.isDir ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--c-muted)" strokeWidth="2.5"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s', flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        ) : (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(entry.name, false), flexShrink: 0, marginLeft: 2, marginRight: 2 }} />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
      </div>
      {expanded && (
        <div>
          {loading && <div style={{ paddingLeft: 8 + (depth + 1) * 12, fontSize: 11, color: 'var(--c-muted)' }}>…</div>}
          {children?.map(c => (
            <TreeNode key={c.path} entry={c} depth={depth + 1} onOpenFile={onOpenFile} onSplitFile={onSplitFile} activePath={activePath} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Source Control panel ───────────────────────────────────────────────────────
function GitFileRow({ file, color, onOpen, action, actionLabel }) {
  return (
    <div className="flex items-center gap-2 group" style={{ padding: '3px 8px', fontSize: 11.5 }}>
      <span style={{ width: 14, flexShrink: 0, color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{color ? '●' : ''}</span>
      <span onClick={onOpen} className="flex-1 cursor-pointer" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text)' }}>
        {file}
      </span>
      <button className="btn-icon" style={{ fontSize: 9, padding: '2px 6px', color: 'var(--c-accent)' }} onClick={() => action(file)}>
        {actionLabel}
      </button>
    </div>
  );
}

function GitPanel({ rootDir, onOpenFile }) {
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!rootDir) { setStatus(null); return; }
    const res = await window.zeus?.gitStatus(rootDir);
    setStatus(res);
  }, [rootDir]);

  useEffect(() => { refresh(); }, [refresh]);

  const stage = async (file) => { await window.zeus?.gitStage(rootDir, [file]); refresh(); };
  const unstage = async (file) => { await window.zeus?.gitUnstage(rootDir, [file]); refresh(); };
  const stageAll = async () => { const files = [...(status?.unstaged || []), ...(status?.untracked || [])]; if (files.length) { await window.zeus?.gitStage(rootDir, files); refresh(); } };
  const commit = async () => {
    if (!msg.trim() || busy) return;
    setBusy(true);
    const res = await window.zeus?.gitCommit(rootDir, msg.trim());
    setBusy(false);
    if (res?.error) { alert('Commit failed: ' + res.error); return; }
    setMsg(''); refresh();
  };

  if (!rootDir) return <div style={{ padding: 16, fontSize: 12, color: 'var(--c-muted)' }}>Open a folder to see source control.</div>;
  if (!status) return <div style={{ padding: 16, fontSize: 12, color: 'var(--c-muted)' }}>Loading…</div>;
  if (!status.ok) return <div style={{ padding: 16, fontSize: 12, color: 'var(--c-muted)' }}>{status.error || 'Not a git repository.'}</div>;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ padding: '8px 0' }}>
      <div className="flex items-center gap-2" style={{ padding: '0 8px 8px' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2.5"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 9v6M18 9a9 9 0 0 1-9 9"/></svg>
        <span style={{ fontSize: 11, color: 'var(--c-accent)', fontFamily: 'JetBrains Mono, monospace' }}>{status.branch}</span>
      </div>

      <div style={{ padding: '0 8px 8px' }}>
        <textarea rows={2} placeholder="Commit message"
          value={msg} onChange={e => setMsg(e.target.value)}
          style={{ width: '100%', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 6, color: 'var(--c-text)', fontSize: 11.5, padding: '6px 8px', resize: 'vertical' }}
        />
        <button className="btn-primary rounded-lg w-full mt-1.5 py-1.5" style={{ fontSize: 10.5, opacity: (!msg.trim() || !status.staged?.length || busy) ? 0.5 : 1 }}
          disabled={!msg.trim() || !status.staged?.length || busy} onClick={commit}>
          {busy ? 'COMMITTING…' : `COMMIT${status.staged?.length ? ` (${status.staged.length})` : ''}`}
        </button>
      </div>

      {status.staged?.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between" style={{ padding: '2px 8px' }}>
            <span style={{ fontSize: 9.5, color: 'var(--c-muted)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>STAGED CHANGES</span>
          </div>
          {status.staged.map(f => (
            <GitFileRow key={f} file={f} color={GIT_STATUS_COLOR.A} onOpen={() => onOpenFile(f)} action={unstage} actionLabel="−" />
          ))}
        </div>
      )}

      {status.unstaged?.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between" style={{ padding: '2px 8px' }}>
            <span style={{ fontSize: 9.5, color: 'var(--c-muted)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>CHANGES</span>
            <button className="btn-icon" style={{ fontSize: 9, padding: '1px 6px', color: 'var(--c-accent)' }} onClick={stageAll}>STAGE ALL</button>
          </div>
          {status.unstaged.map(f => (
            <GitFileRow key={f} file={f} color={GIT_STATUS_COLOR.M} onOpen={() => onOpenFile(f)} action={stage} actionLabel="+" />
          ))}
        </div>
      )}

      {status.untracked?.length > 0 && (
        <div className="mb-2">
          <div style={{ padding: '2px 8px' }}>
            <span style={{ fontSize: 9.5, color: 'var(--c-muted)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>UNTRACKED</span>
          </div>
          {status.untracked.map(f => (
            <GitFileRow key={f} file={f} color={GIT_STATUS_COLOR.U} onOpen={() => onOpenFile(f)} action={stage} actionLabel="+" />
          ))}
        </div>
      )}

      {!status.staged?.length && !status.unstaged?.length && !status.untracked?.length && (
        <div style={{ padding: '0 8px', fontSize: 11.5, color: 'var(--c-muted)' }}>No changes.</div>
      )}
    </div>
  );
}

// ─── New project modal ──────────────────────────────────────────────────────────
function NewProjectModal({ onClose, onCreated }) {
  const [parentDir, setParentDir] = useState('');
  const [name, setName] = useState('');
  const [initGit, setInitGit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pickLocation = async () => {
    const dir = await window.zeus?.pickDirectory();
    if (dir) setParentDir(dir);
  };

  const create = async () => {
    if (!parentDir || !name.trim() || busy) return;
    setBusy(true); setError('');
    const res = await window.zeus?.projectNew(parentDir, name.trim(), initGit);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    onCreated(res.dir);
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="rounded-xl p-5" style={{ width: 360, background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
        <p style={{ color: 'var(--c-accent)', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', marginBottom: 14 }}>NEW PROJECT</p>

        <label style={{ color: 'var(--c-muted)', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>PROJECT NAME</label>
        <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="my-app"
          style={{ width: '100%', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, color: 'var(--c-text)', fontSize: 12, padding: '7px 9px', marginBottom: 12 }} />

        <label style={{ color: 'var(--c-muted)', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>LOCATION</label>
        <div className="flex gap-2 mb-3">
          <input type="text" readOnly value={parentDir} placeholder="Choose a folder…"
            style={{ flex: 1, background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, color: 'var(--c-muted)', fontSize: 11.5, padding: '7px 9px' }} />
          <button className="btn-icon" style={{ fontSize: 10, padding: '6px 10px', color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }} onClick={pickLocation}>BROWSE</button>
        </div>

        <label className="flex items-center gap-2 mb-4" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={initGit} onChange={e => setInitGit(e.target.checked)} />
          <span style={{ fontSize: 12, color: 'var(--c-text)' }}>Initialize git repository</span>
        </label>

        {error && <p style={{ color: 'var(--c-red)', fontSize: 11, marginBottom: 10 }}>{error}</p>}

        <div className="flex gap-2">
          <button className="btn-icon flex-1" style={{ fontSize: 11, padding: '7px 0', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }} onClick={onClose}>CANCEL</button>
          <button className="btn-primary flex-1 rounded-lg" style={{ fontSize: 11, opacity: (!parentDir || !name.trim() || busy) ? 0.5 : 1 }}
            disabled={!parentDir || !name.trim() || busy} onClick={create}>
            {busy ? 'CREATING…' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Editor pane (tab strip + Monaco) for one group (main or split) ────────────
function EditorPane({ tabs, activePath, setActivePath, onChange, onCloseTab, onSave, focused, onFocus, onSplit, allowSplit }) {
  const activeTab = tabs.find(t => t.path === activePath) || null;
  return (
    <div className="flex flex-col flex-1 overflow-hidden" onMouseDown={onFocus} style={{ outline: focused ? '1px solid rgba(0,212,255,0.25)' : 'none', outlineOffset: -1 }}>
      <div className="flex items-stretch flex-shrink-0 overflow-x-auto"
        style={{ height: 34, background: '#080c14', borderBottom: '1px solid var(--c-border)' }}>
        {tabs.map(t => (
          <div key={t.path} onClick={() => setActivePath(t.path)}
            className="flex items-center gap-2 px-3 cursor-pointer flex-shrink-0"
            style={{
              fontSize: 12, color: t.path === activePath ? 'var(--c-text)' : 'var(--c-muted)',
              background: t.path === activePath ? 'var(--c-bg)' : 'transparent',
              borderRight: '1px solid var(--c-border)',
              borderTop: t.path === activePath ? '2px solid var(--c-accent)' : '2px solid transparent',
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(t.name, false) }} />
            {t.name}{t.dirty && <span style={{ color: 'var(--c-accent)' }}>•</span>}
            {allowSplit && t.path === activePath && (
              <span onClick={(e) => { e.stopPropagation(); onSplit(t); }} title="Split right"
                style={{ marginLeft: 2, fontSize: 12, opacity: 0.55 }}>⫶</span>
            )}
            <span onClick={(e) => { e.stopPropagation(); onCloseTab(t.path); }}
              style={{ marginLeft: 2, fontSize: 13, opacity: 0.6 }} title="Close tab">✕</span>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <Editor
            height="100%"
            theme="vs-dark"
            path={activeTab.path}
            language={activeTab.lang}
            value={activeTab.content}
            onChange={onChange}
            options={{
              fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
              minimap: { enabled: true }, automaticLayout: true,
              scrollBeyondLastLine: false, tabSize: 2, wordWrap: 'on',
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--c-muted)', fontSize: 13 }}>
            Open a file from the tree to start editing · Ctrl+S to save
          </div>
        )}
      </div>
    </div>
  );
}

export default function CodeEditor({ onClose }) {
  const [rootDir, setRootDir]   = useState('');
  const [rootEntries, setRootEntries] = useState([]);
  const [sidebarView, setSidebarView] = useState('explorer'); // 'explorer' | 'git'
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const [tabs, setTabs]         = useState([]);   // { path, name, content, dirty, lang }
  const [activePath, setActivePath] = useState(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitTabs, setSplitTabs] = useState([]);
  const [splitActivePath, setSplitActivePath] = useState(null);
  const [focusedSide, setFocusedSide] = useState('main'); // 'main' | 'split'

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // bump to reload iframe

  const openFolder = useCallback(async () => {
    const dir = await window.zeus?.pickDirectory();
    if (!dir) return;
    setRootDir(dir);
    const res = await window.zeus?.editorListDir(dir);
    setRootEntries(Array.isArray(res) ? res : []);
  }, []);

  const onProjectCreated = useCallback(async (dir) => {
    setNewProjectOpen(false);
    setRootDir(dir);
    const res = await window.zeus?.editorListDir(dir);
    setRootEntries(Array.isArray(res) ? res : []);
  }, []);

  // Generic "open this entry into a side" — used by the explorer tree, git panel, and split.
  const openFileInto = useCallback(async (side, entry) => {
    const path_ = entry.path, name = entry.name;
    const isMain = side === 'main';
    const curTabs = isMain ? tabs : splitTabs;
    const existing = curTabs.find(t => t.path === path_);
    if (existing) { (isMain ? setActivePath : setSplitActivePath)(path_); return; }
    const res = await window.zeus?.editorReadFile(path_);
    if (res?.error) { alert(`Can't open ${name}: ${res.error}`); return; }
    const tab = { path: path_, name, content: res.content ?? '', dirty: false, lang: langFromPath(name) };
    if (isMain) { setTabs(prev => [...prev, tab]); setActivePath(path_); }
    else { setSplitTabs(prev => [...prev, tab]); setSplitActivePath(path_); }
  }, [tabs, splitTabs]);

  const openFile = useCallback((entry) => openFileInto(focusedSide, entry), [openFileInto, focusedSide]);

  const splitFile = useCallback((entryOrTab) => {
    setSplitOpen(true);
    openFileInto('split', entryOrTab);
    setFocusedSide('split');
  }, [openFileInto]);

  const openGitFile = useCallback((relPath) => {
    const sep = rootDir.includes('/') && !rootDir.includes('\\') ? '/' : '\\';
    openFile({ path: rootDir ? `${rootDir}${sep}${relPath}` : relPath, name: relPath.split(/[\\/]/).pop() });
  }, [openFile, rootDir]);

  const closeTab = useCallback((side, path) => {
    const isMain = side === 'main';
    const setT = isMain ? setTabs : setSplitTabs;
    const curActive = isMain ? activePath : splitActivePath;
    const setA = isMain ? setActivePath : setSplitActivePath;
    setT(prev => {
      const next = prev.filter(t => t.path !== path);
      if (path === curActive) setA(next.length ? next[next.length - 1].path : null);
      return next;
    });
  }, [activePath, splitActivePath]);

  const onChange = useCallback((side, value) => {
    const isMain = side === 'main';
    const setT = isMain ? setTabs : setSplitTabs;
    const curActive = isMain ? activePath : splitActivePath;
    setT(prev => prev.map(t => t.path === curActive ? { ...t, content: value ?? '', dirty: true } : t));
  }, [activePath, splitActivePath]);

  const save = useCallback(async () => {
    const isMain = focusedSide === 'main';
    const curTabs = isMain ? tabs : splitTabs;
    const curActive = isMain ? activePath : splitActivePath;
    const tab = curTabs.find(t => t.path === curActive);
    if (!tab || !tab.dirty) return;
    const res = await window.zeus?.editorWriteFile(tab.path, tab.content);
    if (res?.error) { alert(`Save failed: ${res.error}`); return; }
    const setT = isMain ? setTabs : setSplitTabs;
    setT(prev => prev.map(t => t.path === tab.path ? { ...t, dirty: false } : t));
    setPreviewKey(k => k + 1); // live-preview refresh on save
  }, [tabs, splitTabs, activePath, splitActivePath, focusedSide]);

  // Ctrl+S → save active file (in the focused pane). Esc → close editor.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') { if (newProjectOpen) setNewProjectOpen(false); else onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, onClose, newProjectOpen]);

  const activeTab = tabs.find(t => t.path === activePath) || null;
  const previewSrc = activeTab && /\.html?$/i.test(activeTab.name)
    ? `file:///${activeTab.path.replace(/\\/g, '/')}?t=${previewKey}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-[60] flex flex-col"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ height: 40, borderBottom: '1px solid var(--c-border)', background: '#080c14' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
        <span style={{ color: 'var(--c-accent)', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.12em' }}>
          CODE EDITOR
        </span>
        <span style={{ color: 'var(--c-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
          {rootDir ? rootDir.split(/[\\/]/).pop() : 'no folder'}
        </span>
        <div className="flex-1" />
        <button className="btn-icon" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--c-accent)' }} onClick={() => setNewProjectOpen(true)}>
          NEW PROJECT
        </button>
        <button className="btn-icon" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--c-muted)' }} onClick={openFolder}>
          OPEN FOLDER
        </button>
        {previewSrc && (
          <button className="btn-icon" style={{ fontSize: 10, padding: '3px 8px', color: previewOpen ? 'var(--c-green)' : 'var(--c-muted)' }}
            onClick={() => setPreviewOpen(v => !v)}>
            {previewOpen ? 'HIDE PREVIEW' : 'PREVIEW'}
          </button>
        )}
        <button className="btn-icon w-6 h-6" onClick={onClose} title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar */}
        <div className="flex flex-col items-center flex-shrink-0 py-2 gap-1"
          style={{ width: 40, borderRight: '1px solid var(--c-border)', background: '#06090f' }}>
          <button onClick={() => setSidebarView('explorer')} title="Explorer"
            className="flex items-center justify-center" style={{
              width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: sidebarView === 'explorer' ? 'var(--c-glow)' : 'transparent',
              color: sidebarView === 'explorer' ? 'var(--c-accent)' : 'var(--c-muted)',
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button onClick={() => setSidebarView('git')} title="Source Control"
            className="flex items-center justify-center" style={{
              width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: sidebarView === 'git' ? 'var(--c-glow)' : 'transparent',
              color: sidebarView === 'git' ? 'var(--c-accent)' : 'var(--c-muted)',
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 9v6M18 9a9 9 0 0 1-9 9"/></svg>
          </button>
        </div>

        {/* Sidebar */}
        <div className="flex-shrink-0 overflow-y-auto"
          style={{ width: 220, borderRight: '1px solid var(--c-border)', background: '#0a0e15', padding: sidebarView === 'explorer' ? '8px 4px' : 0 }}>
          {sidebarView === 'explorer' ? (
            rootEntries.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--c-muted)', lineHeight: 1.6 }}>
                No folder open.<br />
                <button className="btn-icon" style={{ fontSize: 11, padding: '4px 10px', marginTop: 8, color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }}
                  onClick={openFolder}>Open a folder</button>
              </div>
            ) : (
              rootEntries.map(e => (
                <TreeNode key={e.path} entry={e} depth={0} onOpenFile={openFile} onSplitFile={splitFile} activePath={focusedSide === 'main' ? activePath : splitActivePath} />
              ))
            )
          ) : (
            <GitPanel rootDir={rootDir} onOpenFile={openGitFile} />
          )}
        </div>

        {/* Editor group(s) + preview */}
        <div className="flex flex-1 overflow-hidden">
          <EditorPane
            tabs={tabs} activePath={activePath} setActivePath={setActivePath}
            onChange={(v) => onChange('main', v)}
            onCloseTab={(p) => closeTab('main', p)}
            focused={focusedSide === 'main'}
            onFocus={() => setFocusedSide('main')}
            onSplit={splitFile}
            allowSplit={!splitOpen}
          />

          {splitOpen && (
            <>
              <div style={{ width: 1, background: 'var(--c-border)', flexShrink: 0 }} />
              <EditorPane
                tabs={splitTabs} activePath={splitActivePath} setActivePath={setSplitActivePath}
                onChange={(v) => onChange('split', v)}
                onCloseTab={(p) => {
                  closeTab('split', p);
                  if (splitTabs.length <= 1) { setSplitOpen(false); setFocusedSide('main'); }
                }}
                focused={focusedSide === 'split'}
                onFocus={() => setFocusedSide('split')}
                allowSplit={false}
              />
            </>
          )}

          {previewOpen && previewSrc && (
            <div className="flex-shrink-0" style={{ width: '40%', borderLeft: '1px solid var(--c-border)', background: '#fff' }}>
              <iframe key={previewKey} src={previewSrc} title="preview"
                style={{ width: '100%', height: '100%', border: 'none' }} />
            </div>
          )}
        </div>
      </div>

      {newProjectOpen && <NewProjectModal onClose={() => setNewProjectOpen(false)} onCreated={onProjectCreated} />}
    </motion.div>
  );
}
