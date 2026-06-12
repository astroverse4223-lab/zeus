import React, { useEffect, useState, useCallback } from 'react';

const labelStyle = {
  color: 'var(--c-muted)', fontSize: '10px',
  fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em',
};

export default function KnowledgePanel() {
  const [sources, setSources] = useState([]);
  const [stats, setStats] = useState({ sourceCount: 0, chunkCount: 0, model: 'nomic-embed-text' });
  const [progress, setProgress] = useState(null); // { file, done, total, phase }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!window.zeus) return;
    setSources(await window.zeus.kbList());
    setStats(await window.zeus.kbStats());
  }, []);

  useEffect(() => {
    refresh();
    const off = window.zeus?.onKbProgress?.((p) => setProgress(p.phase === 'done' ? null : p));
    return () => off && off();
  }, [refresh]);

  const add = useCallback(async (paths) => {
    if (!paths || !paths.length) return;
    setBusy(true); setError('');
    const res = await window.zeus.kbAdd(paths);
    setBusy(false); setProgress(null);
    if (res?.error) setError(String(res.error));
    refresh();
  }, [refresh]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const paths = Array.from(e.dataTransfer.files || []).map((f) => f.path).filter(Boolean);
    add(paths);
  }, [add]);

  const btnStyle = {
    padding: '6px 12px', borderRadius: 6, fontSize: '11px', cursor: 'pointer',
    background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>KNOWLEDGE BASE</label>
        <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: 4 }}>
          {stats.sourceCount} sources · {stats.chunkCount} chunks · {stats.model}
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{
          border: '1px dashed var(--c-border)', borderRadius: 8, padding: 18,
          textAlign: 'center', fontSize: '12px', color: 'var(--c-muted)',
          opacity: busy ? 0.6 : 1, background: 'var(--c-card)',
        }}
      >
        Drag files or a folder here
        <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button style={btnStyle} onClick={async () => add(await window.zeus.kbPickFiles())}>Add files</button>
          <button style={btnStyle} onClick={async () => { const d = await window.zeus.pickDirectory(); if (d) add([d]); }}>Add folder</button>
        </div>
      </div>

      {progress && (
        <div style={{ fontSize: '10px', color: 'var(--c-muted)' }}>
          {progress.phase === 'embed' ? 'Embedding' : 'Reading'} {String(progress.file || '').split(/[\\/]/).pop()} … ({progress.done}/{progress.total})
        </div>
      )}
      {error && <div style={{ fontSize: '11px', color: '#ff6b6b' }}>⚠ {error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sources.length === 0 && <div style={{ fontSize: '11px', color: 'var(--c-muted)', opacity: 0.6 }}>No documents indexed yet.</div>}
        {sources.map((s) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', borderRadius: 6, background: 'var(--c-card)',
            border: '1px solid var(--c-border)', fontSize: '11px',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text)' }}>
              {s.type === 'pdf' ? '📄' : '📝'} {s.name}
              <span style={{ color: 'var(--c-muted)' }}> · {s.chunkCount} chunks</span>
            </span>
            <button
              onClick={async () => { await window.zeus.kbRemove(s.id); refresh(); }}
              style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '13px' }}
              title="Remove"
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
