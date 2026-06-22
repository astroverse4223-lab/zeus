import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import useStore from '../store/useStore.js';

// Remembers each panel's last position/size for the session (not persisted to
// disk) so reopening a panel doesn't reset it back to the centered default.
const rectCache = new Map();

const HANDLE_CURSOR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
const HANDLE_STYLE = {
  n: { top: -4, left: 10, right: 10, height: 8 },
  s: { bottom: -4, left: 10, right: 10, height: 8 },
  e: { right: -4, top: 10, bottom: 10, width: 8 },
  w: { left: -4, top: 10, bottom: 10, width: 8 },
  ne: { top: -4, right: -4, width: 14, height: 14 },
  nw: { top: -4, left: -4, width: 14, height: 14 },
  se: { bottom: -4, right: -4, width: 14, height: 14 },
  sw: { bottom: -4, left: -4, width: 14, height: 14 },
};

export default function FloatingPanel({
  id, title, icon, headerExtra = <div className="flex-1" />, onClose, onEscape, children,
  defaultWidth = 960, defaultHeight = 640, minWidth = 420, minHeight = 280, resizable = true,
}) {
  const floatingPanels = useStore(s => s.floatingPanels);
  const registerFloatingPanel = useStore(s => s.registerFloatingPanel);
  const unregisterFloatingPanel = useStore(s => s.unregisterFloatingPanel);
  const setPanelMinimized = useStore(s => s.setPanelMinimized);
  const bringPanelToFront = useStore(s => s.bringPanelToFront);

  const panel = floatingPanels[id];
  const minimized = panel?.minimized || false;
  const zIndex = panel?.z || 60;

  const [rect, setRect] = useState(() => rectCache.get(id) || {
    x: Math.max(16, Math.round((window.innerWidth - defaultWidth) / 2)),
    y: Math.max(16, Math.round((window.innerHeight - defaultHeight) / 2)),
    width: defaultWidth, height: defaultHeight,
  });
  const [maximized, setMaximized] = useState(false);
  const preMaximizeRect = useRef(null);

  useEffect(() => {
    registerFloatingPanel(id, title);
    return () => unregisterFloatingPanel(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { rectCache.set(id, rect); }, [id, rect]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') (onEscape || onClose)(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onEscape]);

  const startDrag = useCallback((e) => {
    if (maximized || e.target.closest('button')) return;
    bringPanelToFront(id);
    const start = { x: e.clientX, y: e.clientY, origX: rect.x, origY: rect.y };
    const onMove = (ev) => {
      setRect(r => ({
        ...r,
        x: Math.min(Math.max(-r.width + 120, start.origX + (ev.clientX - start.x)), window.innerWidth - 60),
        y: Math.min(Math.max(0, start.origY + (ev.clientY - start.y)), window.innerHeight - 40),
      }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rect, maximized, id, bringPanelToFront]);

  const startResize = useCallback((dir) => (e) => {
    e.stopPropagation();
    if (maximized) return;
    bringPanelToFront(id);
    const start = { x: e.clientX, y: e.clientY, ...rect };
    const onMove = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      setRect(() => {
        let { x, y, width, height } = start;
        if (dir.includes('e')) width = Math.max(minWidth, start.width + dx);
        if (dir.includes('s')) height = Math.max(minHeight, start.height + dy);
        if (dir.includes('w')) { width = Math.max(minWidth, start.width - dx); x = start.x + (start.width - width); }
        if (dir.includes('n')) { height = Math.max(minHeight, start.height - dy); y = start.y + (start.height - height); }
        return { x, y, width, height };
      });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rect, maximized, id, bringPanelToFront, minWidth, minHeight]);

  const toggleMaximize = useCallback(() => {
    setMaximized(m => {
      if (m) { setRect(preMaximizeRect.current || rect); return false; }
      preMaximizeRect.current = rect;
      return true;
    });
  }, [rect]);

  if (minimized) return null;

  const style = maximized
    ? { position: 'absolute', inset: 10, zIndex }
    : { position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      style={{
        ...style, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--c-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)',
      }}
      onMouseDownCapture={() => bringPanelToFront(id)}
    >
      {/* Title bar — drag handle */}
      <div
        onMouseDown={startDrag}
        onDoubleClick={toggleMaximize}
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ height: 40, borderBottom: '1px solid var(--c-border)', background: '#080c14', cursor: maximized ? 'default' : 'move', userSelect: 'none' }}
      >
        {icon}
        <span style={{ color: 'var(--c-accent)', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.12em', flexShrink: 0 }}>
          {title}
        </span>
        {headerExtra}
        <button className="btn-icon w-6 h-6 flex-shrink-0" onClick={() => setPanelMinimized(id, true)} title="Minimize">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="19" x2="19" y2="19" />
          </svg>
        </button>
        <button className="btn-icon w-6 h-6 flex-shrink-0" onClick={toggleMaximize} title={maximized ? 'Restore' : 'Maximize'}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="5" y="5" width="14" height="14" rx="1" />
          </svg>
        </button>
        <button className="btn-icon w-6 h-6 flex-shrink-0" onClick={onClose} title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col">{children}</div>

      {/* Resize handles */}
      {resizable && !maximized && Object.keys(HANDLE_STYLE).map(dir => (
        <div key={dir} onMouseDown={startResize(dir)} style={{ position: 'absolute', cursor: HANDLE_CURSOR[dir], zIndex: 5, ...HANDLE_STYLE[dir] }} />
      ))}
    </motion.div>
  );
}
