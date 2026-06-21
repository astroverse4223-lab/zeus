import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuid } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useStore from '../store/useStore.js';
import { MODELS } from './InputBar.jsx';

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai',    label: 'OpenAI' },
  { id: 'gemini',    label: 'Gemini' },
  { id: 'ollama',    label: 'Ollama' },
];

function newPane(provider = 'anthropic') {
  return {
    id: uuid(),
    provider,
    model: MODELS[provider]?.[0]?.id || '',
    content: '',
    status: 'idle', // idle | streaming | done | error
    error: null,
    ms: 0,
    streamId: null,
  };
}

export default function ModelCompare({ onClose }) {
  const { settings } = useStore();
  const [prompt, setPrompt] = useState('');
  const [panes, setPanes] = useState(() => [newPane('anthropic'), newPane('openai')]);
  const [running, setRunning] = useState(false);
  const [ollamaInstalled, setOllamaInstalled] = useState([]);

  const panesRef = useRef(panes);
  panesRef.current = panes;
  const unsubRef = useRef(null);
  const startRef = useRef({});

  // Load the real list of locally-installed Ollama models, same as the main InputBar picker.
  useEffect(() => {
    if (!window.zeus?.ollamaModels) return;
    let alive = true;
    window.zeus.ollamaModels()
      .then(res => { if (alive) setOllamaInstalled((res?.models || []).map(m => m.name).filter(Boolean)); })
      .catch(() => { if (alive) setOllamaInstalled([]); });
    return () => { alive = false; };
  }, []);

  const patchPane = (id, patch) =>
    setPanes(prev => prev.map(p => p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p));

  const setProvider = (id, provider) =>
    patchPane(id, { provider, model: provider === 'ollama' ? (ollamaInstalled[0] || MODELS.ollama[0]?.id || '') : (MODELS[provider]?.[0]?.id || '') });

  const addPane = () => { if (panes.length < 4) setPanes(prev => [...prev, newPane('gemini')]); };
  const removePane = (id) => setPanes(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);

  // Single global chunk listener routes by streamId → pane.
  useEffect(() => {
    if (!window.zeus?.onChunk) return;
    unsubRef.current = window.zeus.onChunk((chunk) => {
      const pane = panesRef.current.find(p => p.streamId === chunk.streamId);
      if (!pane) return;
      if (chunk.type === 'text') patchPane(pane.id, p => ({ content: p.content + chunk.text }));
      else if (chunk.type === 'replace') patchPane(pane.id, { content: chunk.text });
      else if (chunk.type === 'error') patchPane(pane.id, { status: 'error', error: chunk.error, ms: Date.now() - (startRef.current[pane.id] || Date.now()) });
      else if (chunk.type === 'done') patchPane(pane.id, { status: 'done', ms: Date.now() - (startRef.current[pane.id] || Date.now()) });
    });
    return () => { unsubRef.current?.(); };
  }, []);

  // When every pane finishes, clear the running flag.
  useEffect(() => {
    if (running && panes.every(p => p.status === 'done' || p.status === 'error')) setRunning(false);
  }, [panes, running]);

  const run = useCallback(() => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    const messages = [{ role: 'user', content: prompt.trim() }];

    setPanes(prev => prev.map(p => {
      const streamId = uuid();
      startRef.current[p.id] = Date.now();
      const cfg = settings?.providers?.[p.provider] || {};
      if (!cfg.apiKey && p.provider !== 'ollama') {
        return { ...p, status: 'error', error: `No API key for ${p.provider}`, content: '', streamId: null };
      }
      // Fire the request (fire-and-forget; chunks arrive via the listener)
      window.zeus?.sendMessage({
        streamId, messages,
        provider: p.provider, model: p.model,
        apiKey: cfg.apiKey || '', baseURL: cfg.baseURL || '',
        agentMode: false,
      });
      return { ...p, status: 'streaming', content: '', error: null, ms: 0, streamId };
    }));
  }, [prompt, running, settings]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, run]);

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
          <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" />
        </svg>
        <span style={{ color: 'var(--c-accent)', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.12em' }}>
          MODEL COMPARE
        </span>
        <div className="flex-1" />
        <button className="btn-icon" style={{ fontSize: 10, padding: '3px 8px', color: panes.length < 4 ? 'var(--c-accent)' : 'var(--c-muted)' }}
          onClick={addPane} disabled={panes.length >= 4}>
          + ADD MODEL
        </button>
        <button className="btn-icon w-6 h-6" onClick={onClose} title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Prompt row */}
      <div className="flex items-end gap-2 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type one prompt — sent to every model below. Ctrl+Enter to run."
          className="flex-1 rounded-lg px-3 py-2 outline-none resize-none"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)', fontSize: 14, minHeight: 44, maxHeight: 120, lineHeight: 1.5 }}
          rows={1}
        />
        <button
          onClick={run}
          disabled={running || !prompt.trim()}
          className="btn-icon flex-shrink-0"
          style={{
            padding: '10px 18px', fontSize: 12, fontWeight: 600,
            color: running ? 'var(--c-muted)' : 'var(--c-bg)',
            background: running ? 'var(--c-card)' : 'var(--c-accent)',
            border: '1px solid var(--c-accent)', borderRadius: 8,
          }}
        >
          {running ? 'RUNNING…' : 'COMPARE'}
        </button>
      </div>

      {/* Columns */}
      <div className="flex flex-1 overflow-hidden">
        {panes.map(pane => (
          <div key={pane.id} className="flex flex-col flex-1 overflow-hidden"
            style={{ borderRight: '1px solid var(--c-border)', minWidth: 0 }}>
            {/* Pane header */}
            <div className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0"
              style={{ background: '#0a0e15', borderBottom: '1px solid var(--c-border)' }}>
              <select
                value={pane.provider}
                onChange={(e) => setProvider(pane.id, e.target.value)}
                className="outline-none cursor-pointer rounded"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-dim)', fontSize: 11, padding: '2px 4px' }}
              >
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              {pane.provider === 'ollama' && ollamaInstalled.length === 0 ? (
                <input
                  value={pane.model}
                  onChange={(e) => patchPane(pane.id, { model: e.target.value })}
                  placeholder="model name"
                  className="outline-none rounded flex-1 min-w-0"
                  style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-dim)', fontSize: 11, padding: '2px 4px' }}
                  list={`ollama-${pane.id}`}
                />
              ) : (
                <select
                  value={pane.model}
                  onChange={(e) => patchPane(pane.id, { model: e.target.value })}
                  className="outline-none cursor-pointer rounded flex-1 min-w-0"
                  style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-dim)', fontSize: 11, padding: '2px 4px' }}
                >
                  {pane.provider === 'ollama' ? (
                    <>
                      {pane.model && !ollamaInstalled.includes(pane.model) && <option value={pane.model}>{pane.model} (not installed)</option>}
                      {ollamaInstalled.map(name => <option key={name} value={name}>{name}</option>)}
                    </>
                  ) : (
                    (MODELS[pane.provider] || []).map(m => <option key={m.id} value={m.id}>{m.label}</option>)
                  )}
                </select>
              )}
              <datalist id={`ollama-${pane.id}`}>
                {MODELS.ollama.map(m => <option key={m.id} value={m.id} />)}
              </datalist>
              {pane.status === 'streaming' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-green)', animation: 'blink 0.8s ease-in-out infinite', flexShrink: 0 }} />
              )}
              {pane.status === 'done' && pane.ms > 0 && (
                <span style={{ fontSize: 10, color: 'var(--c-muted)', flexShrink: 0 }}>{(pane.ms / 1000).toFixed(1)}s</span>
              )}
              {panes.length > 1 && (
                <button onClick={() => removePane(pane.id)} title="Remove"
                  style={{ background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
              )}
            </div>

            {/* Pane body */}
            <div className="flex-1 overflow-y-auto px-3 py-2 zeus-md" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-text)' }}>
              {pane.status === 'error' ? (
                <div style={{ color: 'var(--c-red)', fontSize: 12 }}>⚠ {pane.error}</div>
              ) : pane.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{pane.content}</ReactMarkdown>
              ) : pane.status === 'streaming' ? (
                <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Thinking…</span>
              ) : (
                <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Response appears here.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
