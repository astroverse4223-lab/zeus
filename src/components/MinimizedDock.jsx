import React from 'react';
import useStore from '../store/useStore.js';

export default function MinimizedDock() {
  const floatingPanels = useStore(s => s.floatingPanels);
  const setPanelMinimized = useStore(s => s.setPanelMinimized);

  const minimized = Object.entries(floatingPanels).filter(([, p]) => p.minimized);
  if (!minimized.length) return null;

  return (
    <div className="fixed bottom-3 left-3 flex gap-2 flex-wrap" style={{ zIndex: 500, maxWidth: '60vw' }}>
      {minimized.map(([id, p]) => (
        <button
          key={id}
          onClick={() => setPanelMinimized(id, false)}
          className="flex items-center gap-2"
          style={{
            fontSize: 10.5, padding: '7px 12px', borderRadius: 8, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em',
            background: 'var(--c-card)', border: '1px solid var(--c-accent)', color: 'var(--c-accent)',
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
          }}
          title="Restore"
        >
          {p.title}
        </button>
      ))}
    </div>
  );
}
