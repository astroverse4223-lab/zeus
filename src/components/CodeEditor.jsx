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

// One node in the file tree. Directories lazy-load their children on expand.
function TreeNode({ entry, depth, onOpenFile, activePath }) {
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
        className="flex items-center gap-1.5 cursor-pointer select-none"
        style={{
          padding: '3px 8px', paddingLeft: 8 + depth * 12,
          fontSize: 12.5, color: isActive ? 'var(--c-accent)' : 'var(--c-text)',
          background: isActive ? 'rgba(0,212,255,0.10)' : 'transparent',
          borderRadius: 4, transition: 'background 0.1s',
        }}
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
            <TreeNode key={c.path} entry={c} depth={depth + 1} onOpenFile={onOpenFile} activePath={activePath} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CodeEditor({ onClose }) {
  const [rootDir, setRootDir]   = useState('');
  const [rootEntries, setRootEntries] = useState([]);
  const [tabs, setTabs]         = useState([]);   // { path, name, content, dirty, lang }
  const [activePath, setActivePath] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // bump to reload iframe
  const editorRef = useRef(null);

  const activeTab = tabs.find(t => t.path === activePath) || null;

  const openFolder = useCallback(async () => {
    const dir = await window.zeus?.pickDirectory();
    if (!dir) return;
    setRootDir(dir);
    const res = await window.zeus?.editorListDir(dir);
    setRootEntries(Array.isArray(res) ? res : []);
  }, []);

  const openFile = useCallback(async (entry) => {
    if (entry.isDir) return;
    const existing = tabs.find(t => t.path === entry.path);
    if (existing) { setActivePath(entry.path); return; }
    const res = await window.zeus?.editorReadFile(entry.path);
    if (res?.error) { alert(`Can't open ${entry.name}: ${res.error}`); return; }
    setTabs(prev => [...prev, {
      path: entry.path, name: entry.name,
      content: res.content ?? '', dirty: false, lang: langFromPath(entry.name),
    }]);
    setActivePath(entry.path);
  }, [tabs]);

  const closeTab = useCallback((path, e) => {
    e?.stopPropagation();
    setTabs(prev => {
      const next = prev.filter(t => t.path !== path);
      if (path === activePath) setActivePath(next.length ? next[next.length - 1].path : null);
      return next;
    });
  }, [activePath]);

  const onChange = useCallback((value) => {
    setTabs(prev => prev.map(t => t.path === activePath ? { ...t, content: value ?? '', dirty: true } : t));
  }, [activePath]);

  const save = useCallback(async () => {
    const tab = tabs.find(t => t.path === activePath);
    if (!tab || !tab.dirty) return;
    const res = await window.zeus?.editorWriteFile(tab.path, tab.content);
    if (res?.error) { alert(`Save failed: ${res.error}`); return; }
    setTabs(prev => prev.map(t => t.path === tab.path ? { ...t, dirty: false } : t));
    setPreviewKey(k => k + 1); // live-preview refresh on save
  }, [tabs, activePath]);

  // Ctrl+S → save active file. Esc → close editor.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, onClose]);

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
        {/* File tree */}
        <div className="flex-shrink-0 overflow-y-auto"
          style={{ width: 240, borderRight: '1px solid var(--c-border)', background: '#0a0e15', padding: '8px 4px' }}>
          {rootEntries.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--c-muted)', lineHeight: 1.6 }}>
              No folder open.<br />
              <button className="btn-icon" style={{ fontSize: 11, padding: '4px 10px', marginTop: 8, color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }}
                onClick={openFolder}>Open a folder</button>
            </div>
          ) : (
            rootEntries.map(e => (
              <TreeNode key={e.path} entry={e} depth={0} onOpenFile={openFile} activePath={activePath} />
            ))
          )}
        </div>

        {/* Editor + tabs */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
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
                <span onClick={(e) => closeTab(t.path, e)}
                  style={{ marginLeft: 2, fontSize: 13, opacity: 0.6 }} title="Close tab">✕</span>
              </div>
            ))}
          </div>

          {/* Monaco + preview split */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {activeTab ? (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  path={activeTab.path}
                  language={activeTab.lang}
                  value={activeTab.content}
                  onChange={onChange}
                  onMount={(ed) => { editorRef.current = ed; }}
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

            {previewOpen && previewSrc && (
              <div className="flex-shrink-0" style={{ width: '45%', borderLeft: '1px solid var(--c-border)', background: '#fff' }}>
                <iframe key={previewKey} src={previewSrc} title="preview"
                  style={{ width: '100%', height: '100%', border: 'none' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
