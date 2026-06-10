import React, { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../store/useStore.js';

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

export default function InputBar({ onSend, onStop, onAgent, terminalOpen, onToggleTerminal }) {
  const { settings, setSettings, streaming } = useStore();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState('chat'); // 'chat' | 'agent'
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const provider  = settings?.activeProvider || 'anthropic';
  const model     = settings?.providers?.[provider]?.model || '';
  const modelList = MODELS[provider] || [];

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }, [text]);

  // Focus on mount
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    if (mode === 'agent' && onAgent) {
      onAgent(trimmed);
    } else {
      onSend(trimmed);
    }
    setText('');
    textareaRef.current?.focus();
  }, [text, streaming, onSend, onAgent, mode]);

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
      className="flex-shrink-0 px-4 pb-4 pt-2"
      style={{ background: 'linear-gradient(0deg, var(--c-bg) 80%, transparent)' }}
    >
      {/* Model selector row */}
      <div className="flex items-center gap-2 mb-2 px-1">
        {/* Chat / Agent mode toggle */}
        <div
          className="flex items-center rounded-lg flex-shrink-0"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', padding: '2px' }}
        >
          <button
            onClick={() => setMode('chat')}
            style={{
              padding: '3px 9px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', border: 'none',
              fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em', transition: 'all 0.15s',
              background: mode === 'chat' ? 'var(--c-accent)' : 'transparent',
              color: mode === 'chat' ? '#080c14' : 'var(--c-muted)',
              fontWeight: mode === 'chat' ? 700 : 400,
              boxShadow: mode === 'chat' ? '0 0 8px rgba(0,212,255,0.4)' : 'none',
            }}
          >
            CHAT
          </button>
          <button
            onClick={() => setMode('agent')}
            style={{
              padding: '3px 9px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', border: 'none',
              fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em', transition: 'all 0.15s',
              background: mode === 'agent' ? 'var(--c-purple)' : 'transparent',
              color: mode === 'agent' ? '#fff' : 'var(--c-muted)',
              fontWeight: mode === 'agent' ? 700 : 400,
              boxShadow: mode === 'agent' ? '0 0 8px rgba(168,85,247,0.4)' : 'none',
            }}
          >
            AGENT
          </button>
        </div>

        <span style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
          MODEL
        </span>
        <div className="relative">
          {provider === 'ollama' ? (
            /* Ollama: free-text model name since user can pull anything */
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
          {/* Datalist for Ollama autocomplete suggestions */}
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
            : mode === 'agent' ? 'Describe a coding task — Zeus will read, write and edit files autonomously…'
            : 'Ask Zeus anything, or command your PC…'
          }
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          rows={1}
        />

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
            title={mode === 'agent' ? 'Launch agent (Enter)' : 'Send (Enter)'}
            style={{
              opacity: text.trim() ? 1 : 0.4,
              cursor: text.trim() ? 'pointer' : 'default',
              border: 'none',
              background: mode === 'agent'
                ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                : 'linear-gradient(135deg, var(--c-accent2), var(--c-accent))',
              boxShadow: text.trim()
                ? mode === 'agent' ? '0 0 14px rgba(168,85,247,0.45)' : '0 0 14px rgba(0,212,255,0.35)'
                : 'none',
              color: '#fff',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
          >
            {mode === 'agent' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
