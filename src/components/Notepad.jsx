import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useStore from '../store/useStore.js';

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function Notepad({ onClose }) {
  const { notes, addNote, updateNote, deleteNote } = useStore();
  const [activeId, setActiveId] = useState(notes[0]?.id || null);

  const active = notes.find(n => n.id === activeId) || null;

  // Keep a valid selection as notes change.
  useEffect(() => {
    if (!active && notes.length) setActiveId(notes[0].id);
  }, [notes, active]);

  const create = () => setActiveId(addNote());

  const remove = (id, e) => {
    e?.stopPropagation();
    if (!confirm('Delete this note?')) return;
    deleteNote(id);
    if (id === activeId) setActiveId(notes.find(n => n.id !== id)?.id || null);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
        </svg>
        <span style={{ color: 'var(--c-accent)', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.12em' }}>
          NOTEPAD
        </span>
        <span style={{ color: 'var(--c-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
          {notes.length} note{notes.length === 1 ? '' : 's'}
        </span>
        <div className="flex-1" />
        <button className="btn-icon" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }} onClick={create}>
          + NEW NOTE
        </button>
        <button className="btn-icon w-6 h-6" onClick={onClose} title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Note list */}
        <div className="flex-shrink-0 overflow-y-auto"
          style={{ width: 260, borderRight: '1px solid var(--c-border)', background: '#0a0e15', padding: 8 }}>
          {notes.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--c-muted)', lineHeight: 1.6 }}>
              No notes yet.<br />
              <button className="btn-icon" style={{ fontSize: 11, padding: '4px 10px', marginTop: 8, color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }} onClick={create}>
                Create your first note
              </button>
            </div>
          ) : (
            notes.map(n => (
              <div key={n.id} onClick={() => setActiveId(n.id)}
                className="group flex items-start gap-2 cursor-pointer"
                style={{
                  padding: '8px 10px', borderRadius: 6, marginBottom: 4,
                  background: n.id === activeId ? 'rgba(0,212,255,0.10)' : 'transparent',
                  border: n.id === activeId ? '1px solid var(--c-accent)' : '1px solid transparent',
                }}
                onMouseEnter={(e) => { if (n.id !== activeId) e.currentTarget.style.background = 'var(--c-glow)'; }}
                onMouseLeave={(e) => { if (n.id !== activeId) e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex-1 overflow-hidden">
                  <div style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title || 'Untitled'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {(n.body || '').slice(0, 50) || 'Empty'} · {timeAgo(n.updatedAt)}
                  </div>
                </div>
                <button onClick={(e) => remove(n.id, e)}
                  className="opacity-0 group-hover:opacity-100"
                  style={{ background: 'none', border: 'none', color: 'var(--c-red)', cursor: 'pointer', fontSize: 13, transition: 'opacity 0.12s' }}
                  title="Delete note">✕</button>
              </div>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {active ? (
            <>
              <input
                value={active.title}
                onChange={(e) => updateNote(active.id, { title: e.target.value })}
                placeholder="Title"
                className="bg-transparent outline-none flex-shrink-0"
                style={{
                  padding: '14px 20px 8px', fontSize: 18, fontWeight: 600,
                  color: 'var(--c-text)', border: 'none', borderBottom: '1px solid var(--c-border)',
                }}
                spellCheck={false}
              />
              <textarea
                value={active.body}
                onChange={(e) => updateNote(active.id, { body: e.target.value })}
                placeholder="Start typing… (saved automatically)"
                className="flex-1 bg-transparent outline-none resize-none"
                style={{
                  padding: '14px 20px', fontSize: 14, lineHeight: 1.7,
                  color: 'var(--c-text)', fontFamily: 'JetBrains Mono, monospace', border: 'none',
                }}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--c-muted)', fontSize: 13 }}>
              Select a note, or create a new one.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
