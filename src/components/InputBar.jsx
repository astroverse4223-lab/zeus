import React, { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../store/useStore.js';
import { FAST_MODELS, FAST_MODEL_LABELS } from './HUD.jsx';
import KnowledgePanel from './KnowledgePanel.jsx';

const MODELS = {
  anthropic: [
    { id: 'claude-opus-4-8',           label: 'Claude Opus 4' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4' },
  ],
  openai: [
    { id: 'gpt-4o',       label: 'GPT-4o' },
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini' },
    { id: 'o1-preview',   label: 'o1 Preview' },
    { id: 'o3-mini',      label: 'o3 Mini' },
  ],
  gemini: [
    { id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
  // Ollama: common models that support tool calling
  ollama: [
    { id: 'llama3.2',      label: 'Llama 3.2' },
    { id: 'llama3.2:1b',   label: 'Llama 3.2 1B' },
    { id: 'llama3.1',      label: 'Llama 3.1 8B' },
    { id: 'llama3.1:70b',  label: 'Llama 3.1 70B' },
    { id: 'mistral',       label: 'Mistral 7B' },
    { id: 'mistral-nemo',  label: 'Mistral Nemo' },
    { id: 'qwen2.5',       label: 'Qwen 2.5 7B' },
    { id: 'qwen2.5:14b',   label: 'Qwen 2.5 14B' },
    { id: 'phi4',          label: 'Phi-4' },
    { id: 'phi4-mini',     label: 'Phi-4 Mini' },
    { id: 'deepseek-r1',   label: 'DeepSeek R1' },
    { id: 'gemma2',        label: 'Gemma 2 9B' },
    { id: 'codellama',     label: 'Code Llama' },
  ],
};

// Shorten a path for the directory chip — show the last two segments.
function shortDir(p) {
  if (!p) return '';
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean);
  return parts.length > 2 ? '…\\' + parts.slice(-2).join('\\') : p;
}

export default function InputBar({ onSend, onStop, onOpenAgent, terminalOpen, onToggleTerminal }) {
  const {
    settings, setSettings, streaming, fastMode, agentMode, setAgentMode, agentDir,
    draft: text, setDraft: setText, pendingImage, setPendingImage,
  } = useStore();
  const [listening, setListening] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const provider      = settings?.activeProvider || 'anthropic';
  const configModel   = settings?.providers?.[provider]?.model || '';
  const effectiveModel = fastMode ? (FAST_MODELS[provider] || configModel) : configModel;
  const model         = configModel; // used for the selector value (always shows configured model)
  const modelList     = MODELS[provider] || [];

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }, [text]);

  // Focus on mount
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Turning agent mode on the first time (no directory yet) opens the setup modal.
  const enableAgent = () => {
    setAgentMode(true);
    if (!agentDir) onOpenAgent();
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    if (agentMode) {
      if (!agentDir) { onOpenAgent(); return; } // need a working directory first
      const activeConv = useStore.getState().getActive();
      const isExistingAgent = activeConv?.messages?.some(m =>
        m.role === 'user' && typeof m.content === 'string' &&
        m.content.includes('[ZEUS CODING AGENT — ACTIVATED]')
      );
      // First task in a conversation gets the activation header (nicely rendered + triggers
      // the directory-tree snapshot). Follow-ups send as plain text — the sticky toggle keeps
      // the backend in agent mode bound to agentDir.
      const payload = isExistingAgent
        ? trimmed
        : `[ZEUS CODING AGENT — ACTIVATED]\n\nTask: ${trimmed}\nWorking Directory: ${agentDir}\n\nThe working directory snapshot is attached. Make the changes RIGHT NOW with write_file / patch_file — no plans, no text-only output. Text does not save files. Call task_complete when done.`;
      onSend(payload, pendingImage, true, agentDir);
    } else {
      onSend(trimmed, pendingImage, false, '');
    }
    setText('');
    setPendingImage(null);
    textareaRef.current?.focus();
  }, [text, streaming, onSend, pendingImage, agentMode, agentDir, onOpenAgent]);

  const captureScreen = useCallback(async () => {
    const dataUrl = await window.zeus?.captureScreen();
    if (dataUrl) setPendingImage(dataUrl);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const changeModel = (modelId) => {
    if (!settings) return;
    const updated = {
      ...settings,
      providers: {
        ...settings.providers,
        [provider]: { ...settings.providers[provider], model: modelId },
      },
    };
    setSettings(updated);
    window.zeus?.saveSettings(updated);
  };

  // Voice input
  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <div
      className="flex-shrink-0 px-4 pb-4 pt-2 relative"
      style={{ background: 'linear-gradient(0deg, var(--c-bg) 80%, transparent)' }}
    >
      {/* Knowledge base popover */}
      {kbOpen && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 40 }} onClick={() => setKbOpen(false)} />
          <div
            className="absolute"
            style={{
              bottom: '100%', right: 16, marginBottom: 8, width: 380, maxHeight: 440,
              overflowY: 'auto', zIndex: 50,
              background: 'var(--c-card)', border: '1px solid var(--c-border)',
              borderRadius: 12, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-end" style={{ marginBottom: 4 }}>
              <button
                onClick={() => setKbOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                title="Close"
              >✕</button>
            </div>
            <KnowledgePanel />
          </div>
        </>
      )}

      {/* Model selector row */}
      <div className="flex items-center gap-2 mb-2 px-1">
        {/* Sticky Chat / Agent toggle — stays where you put it, like VSCode */}
        <div
          className="flex items-center rounded-lg flex-shrink-0"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', padding: '2px' }}
        >
          <button
            onClick={() => setAgentMode(false)}
            style={{
              padding: '3px 10px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', border: 'none',
              fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em', transition: 'all 0.15s',
              background: !agentMode ? 'var(--c-accent)' : 'transparent',
              color: !agentMode ? '#080c14' : 'var(--c-muted)',
              fontWeight: !agentMode ? 700 : 400,
              boxShadow: !agentMode ? '0 0 8px rgba(0,212,255,0.4)' : 'none',
            }}
          >
            CHAT
          </button>
          <button
            onClick={enableAgent}
            className="flex items-center gap-1"
            style={{
              padding: '3px 10px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', border: 'none',
              fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em', transition: 'all 0.15s',
              background: agentMode ? 'var(--c-purple)' : 'transparent',
              color: agentMode ? '#fff' : 'var(--c-muted)',
              fontWeight: agentMode ? 700 : 400,
              boxShadow: agentMode ? '0 0 8px rgba(168,85,247,0.4)' : 'none',
            }}
            title="Agent mode stays on — keeps reading, writing & fixing code in your project until you switch back to Chat"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            AGENT
          </button>
        </div>

        {/* Working directory chip — click to change */}
        {agentMode && (
          <button
            onClick={onOpenAgent}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 flex-shrink-0"
            style={{
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)',
              color: agentDir ? 'var(--c-purple)' : 'var(--c-muted)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', cursor: 'pointer',
              maxWidth: 220,
            }}
            title={agentDir ? `Agent working directory:\n${agentDir}\n\nClick to change` : 'Set a project directory for the agent'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <span className="truncate">{agentDir ? shortDir(agentDir) : 'Set folder…'}</span>
          </button>
        )}

        <span style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
          MODEL
        </span>

        {/* Fast mode override badge — shown instead of/alongside model selector */}
        {fastMode ? (
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1" style={{
            background: 'rgba(255,213,0,0.08)',
            border: '1px solid rgba(255,213,0,0.35)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#ffd500" style={{ filter: 'drop-shadow(0 0 3px rgba(255,213,0,0.6))' }}>
              <path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z" />
            </svg>
            <span style={{ color: '#ffd500', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {FAST_MODEL_LABELS[provider] || effectiveModel}
            </span>
            <span style={{ color: 'rgba(255,213,0,0.5)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>
              FAST
            </span>
          </div>
        ) : (
          <div className="relative">
            {provider === 'ollama' ? (
              <input
                type="text"
                className="text-xs rounded-md px-2 py-1 outline-none"
                style={{
                  background: 'var(--c-card)', border: '1px solid var(--c-border)',
                  color: 'var(--c-dim)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
                  width: '130px',
                }}
                placeholder="llama3.2"
                value={model}
                onChange={e => changeModel(e.target.value)}
                list="ollama-models"
              />
            ) : (
              <select
                className="text-xs rounded-md px-2 py-1 outline-none cursor-pointer appearance-none pr-5"
                style={{
                  background: 'var(--c-card)', border: '1px solid var(--c-border)',
                  color: 'var(--c-dim)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
                }}
                value={model}
                onChange={e => changeModel(e.target.value)}
              >
                {modelList.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            )}
            <datalist id="ollama-models">
              {MODELS.ollama.map(m => <option key={m.id} value={m.id} />)}
            </datalist>
            {provider !== 'ollama' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-muted)', pointerEvents: 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </div>
        )}

        <div className="flex-1" />

        <span style={{ color: 'var(--c-muted)', fontSize: '10px' }}>
          {text.length > 0 ? `${text.length} chars` : 'Enter ↵ to send · Shift+Enter for newline'}
        </span>
      </div>

      {/* Input row */}
      <div
        className="flex items-end gap-2 rounded-xl p-2 glow-border"
        style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="zeus-input flex-1 rounded-lg px-3 py-2 text-sm"
          style={{
            minHeight: '44px', maxHeight: '180px',
            background: 'transparent', border: 'none', boxShadow: 'none',
            lineHeight: '1.6', fontSize: '14px',
          }}
          placeholder={
            streaming ? 'Zeus is thinking…'
            : agentMode ? `Agent mode — describe a coding task in ${shortDir(agentDir) || 'your project'}…`
            : 'Ask Zeus anything, or command your PC…'
          }
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          rows={1}
        />

        {/* Attached screenshot thumbnail */}
        {pendingImage && (
          <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
            <img src={pendingImage} alt="screen" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--c-accent)', opacity: 0.85 }} />
            <button
              onClick={() => setPendingImage(null)}
              style={{
                position: 'absolute', top: -4, right: -4, width: 14, height: 14,
                borderRadius: '50%', background: 'var(--c-red)', border: 'none',
                color: '#fff', fontSize: 8, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        )}

        {/* Knowledge base button */}
        <button
          className="btn-icon w-9 h-9 rounded-lg flex-shrink-0"
          style={{
            background: kbOpen ? 'rgba(0,212,255,0.12)' : 'transparent',
            border: kbOpen ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
            color: kbOpen ? 'var(--c-accent)' : 'var(--c-muted)',
            transition: 'all 0.15s',
          }}
          onClick={() => setKbOpen(o => !o)}
          title="Knowledge base — add files/folders for Zeus to reference"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </button>

        {/* Screen capture button */}
        <button
          className="btn-icon w-9 h-9 rounded-lg flex-shrink-0"
          style={{
            background: pendingImage ? 'rgba(0,212,255,0.12)' : 'transparent',
            border: pendingImage ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
            color: pendingImage ? 'var(--c-accent)' : 'var(--c-muted)',
            transition: 'all 0.15s',
          }}
          onClick={captureScreen}
          title="Attach screenshot — let Zeus see your screen"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </button>

        {/* Terminal toggle button */}
        {onToggleTerminal && (
          <button
            className="btn-icon w-9 h-9 rounded-lg flex-shrink-0"
            style={{
              background: terminalOpen ? 'rgba(0,255,128,0.12)' : 'transparent',
              border: terminalOpen ? '1px solid var(--c-green)' : '1px solid var(--c-border)',
              color: terminalOpen ? 'var(--c-green)' : 'var(--c-muted)',
              transition: 'all 0.15s',
            }}
            onClick={onToggleTerminal}
            title={terminalOpen ? 'Hide terminal' : 'Open terminal'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </button>
        )}

        {/* Voice button */}
        <div className="relative flex-shrink-0">
          {listening && <div className="voice-ring" />}
          <button
            className="btn-icon w-9 h-9 rounded-lg flex-shrink-0"
            style={{
              background: listening ? 'rgba(255,51,102,0.15)' : 'transparent',
              border: listening ? '1px solid var(--c-red)' : '1px solid var(--c-border)',
              color: listening ? 'var(--c-red)' : 'var(--c-muted)',
              position: 'relative',
            }}
            onClick={toggleVoice}
            title={listening ? 'Stop recording' : 'Voice input'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        </div>

        {/* Send / Stop button */}
        {streaming ? (
          <button
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(255,51,102,0.15)',
              border: '1px solid var(--c-red)',
              color: 'var(--c-red)',
              cursor: 'pointer',
            }}
            onClick={onStop}
            title="Stop generation"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            onClick={handleSend}
            disabled={!text.trim()}
            title={agentMode ? 'Send to agent (Enter)' : 'Send (Enter)'}
            style={{
              opacity: text.trim() ? 1 : 0.4,
              cursor: text.trim() ? 'pointer' : 'default',
              border: 'none',
              background: agentMode
                ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                : 'linear-gradient(135deg, var(--c-accent2), var(--c-accent))',
              boxShadow: text.trim()
                ? agentMode ? '0 0 14px rgba(168,85,247,0.45)' : '0 0 14px rgba(0,212,255,0.35)'
                : 'none',
              color: '#fff',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
          >
            {agentMode ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Bottom hint */}
      <div className="flex items-center justify-center mt-2 gap-3">
        <span style={{ color: 'var(--c-muted)', fontSize: '10px' }}>
          ZEUS has access to your PC · Use responsibly
        </span>
      </div>
    </div>
  );
}
