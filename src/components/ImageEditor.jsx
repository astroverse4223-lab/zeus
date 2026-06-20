import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import useStore from '../store/useStore.js';

export default function ImageEditor({ onClose }) {
  const { imageEditorSource, setImageEditorSource } = useStore();
  const [source, setSource] = useState(imageEditorSource || null);
  const [name, setName]     = useState('image');
  const [savedMsg, setSavedMsg] = useState('');

  const open = useCallback(async () => {
    const res = await window.zeus?.editorOpenImage();
    if (res?.error) { alert(res.error); return; }
    if (res?.canceled || !res?.dataUrl) { if (!source) onClose(); return; }
    setSource(res.dataUrl);
    setName((res.name || 'image').replace(/\.[^.]+$/, ''));
  }, [source, onClose]);

  // If launched with a handed-off image (e.g. from image gen) use it; otherwise
  // prompt for a file. Clear the hand-off so it doesn't stick on the next open.
  // Guarded with a ref because StrictMode double-invokes mount effects in dev,
  // which would otherwise pop the file dialog twice.
  const openedRef = useRef(false);
  useEffect(() => {
    if (imageEditorSource) { setImageEditorSource(null); return; }
    if (openedRef.current) return;
    openedRef.current = true;
    open();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // FIE calls this on Save. We bypass its built-in download (onBeforeSave→false)
  // and route the bytes through Zeus's save dialog instead.
  const handleSave = useCallback(async (edited) => {
    const dataUrl = edited?.imageBase64;
    if (!dataUrl) return;
    const fn = `${edited.name || name}.${edited.extension || 'png'}`;
    const res = await window.zeus?.editorSaveImage(dataUrl, fn);
    if (res?.error) { alert('Save failed: ' + res.error); return; }
    if (res?.path) { setSavedMsg(`Saved → ${res.path}`); setTimeout(() => setSavedMsg(''), 4000); }
  }, [name]);

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
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
        <span style={{ color: 'var(--c-accent)', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.12em' }}>
          IMAGE EDITOR
        </span>
        {savedMsg && <span style={{ color: 'var(--c-green)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{savedMsg}</span>}
        <div className="flex-1" />
        <button className="btn-icon" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--c-accent)' }} onClick={open}>
          OPEN IMAGE
        </button>
        <button className="btn-icon w-6 h-6" onClick={onClose} title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Editor surface */}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {source ? (
          <FilerobotImageEditor
            source={source}
            onSave={handleSave}
            onBeforeSave={() => false}
            onClose={onClose}
            annotationsCommon={{ fill: '#ff3b3b' }}
            Text={{ text: 'Text…' }}
            Rotate={{ angle: 90, componentType: 'slider' }}
            tabsIds={[TABS.ADJUST, TABS.ANNOTATE, TABS.FINETUNE, TABS.FILTERS, TABS.RESIZE]}
            defaultTabId={TABS.ANNOTATE}
            defaultToolId={TOOLS.PEN}
            savingPixelRatio={1}
            previewPixelRatio={1}
          />
        ) : (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--c-muted)', fontSize: 13 }}>
            <button className="btn-icon" style={{ fontSize: 12, padding: '8px 16px', color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }} onClick={open}>
              Open an image to edit
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
