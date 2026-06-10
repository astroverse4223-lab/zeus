import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useStore from '../store/useStore.js';
import { THEMES, applyTheme } from '../themes.js';
import OllamaManager from './OllamaManager.jsx';

// ─── Shared style helpers ─────────────────────────────────────────────────────
const labelStyle = { color: 'var(--c-muted)', fontSize: '11px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' };
const descStyle  = { color: 'var(--c-muted)', fontSize: '11px', marginTop: '4px', marginBottom: '8px' };
const hintStyle  = { color: 'var(--c-muted)', fontSize: '10px' };
const cardStyle  = { background: 'var(--c-card)', border: '1px solid var(--c-border)' };

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      className="relative rounded-full transition-all flex-shrink-0"
      style={{
        width: '40px', height: '22px',
        background: value ? 'var(--c-accent)' : 'var(--c-border)',
        boxShadow: value ? '0 0 10px rgba(0,212,255,0.4)' : 'none',
        cursor: 'pointer', border: 'none',
      }}
      onClick={() => onChange(!value)}
    >
      <div className="absolute rounded-full transition-all" style={{
        width: '16px', height: '16px', top: '3px',
        left: value ? '21px' : '3px',
        background: value ? '#080c14' : 'var(--c-muted)',
      }} />
    </button>
  );
}

function ToggleRow({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl" style={cardStyle}>
      <div>
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 500 }}>{label}</p>
        {desc && <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: '2px' }}>{desc}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

// ─── Pill selector (font size, speed, density, etc.) ─────────────────────────
function PillSelect({ options, value, onChange }) {
  return (
    <div className="flex gap-2 mt-2">
      {options.map(([val, lbl]) => {
        const active = value === val;
        return (
          <button key={val} onClick={() => onChange(val)} style={{
            flex: 1, padding: '6px 4px',
            background: active ? 'rgba(0,212,255,0.15)' : 'var(--c-card)',
            border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
            color: active ? 'var(--c-accent)' : 'var(--c-muted)',
            borderRadius: '8px', cursor: 'pointer', fontSize: '10px',
            fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em',
            transition: 'all 0.15s',
          }}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

// ─── Theme preview card ───────────────────────────────────────────────────────
function ThemeCard({ id, theme, active, onSelect }) {
  const v = theme.vars;
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(id)}
      style={{
        background: v['--c-bg'],
        border: `1.5px solid ${active ? v['--c-accent'] : v['--c-border']}`,
        borderRadius: '12px', padding: '10px', cursor: 'pointer',
        position: 'relative', overflow: 'hidden',
        boxShadow: active ? `0 0 18px ${v['--c-glow-hi']}, 0 0 40px ${v['--c-glow']}` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{
        height: 9, borderRadius: 4, marginBottom: 6,
        background: v['--c-surface'], border: `1px solid ${v['--c-border']}`,
        display: 'flex', alignItems: 'center', gap: 3, padding: '0 5px',
      }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff3366', flexShrink: 0 }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88', flexShrink: 0 }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ffcc00', flexShrink: 0 }} />
        <div style={{ flex: 1, height: 2, background: v['--c-accent'], borderRadius: 1, opacity: 0.6, marginLeft: 3 }} />
        <div style={{ width: 14, height: 5, borderRadius: 2, background: v['--c-accent'], opacity: 0.4 }} />
      </div>
      <div style={{
        height: 54, borderRadius: 6, background: v['--c-bg'],
        border: `1px solid ${v['--c-border']}`, padding: '5px 6px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            height: 9, width: '58%', borderRadius: '5px 1px 5px 5px',
            background: v['--c-card'], border: `1px solid ${v['--c-border-hi']}`,
            borderRight: `2px solid ${v['--c-accent']}`,
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ height: 8, width: '75%', borderRadius: '1px 5px 5px 5px', background: v['--c-card'], border: `1px solid ${v['--c-border']}`, borderLeft: `2px solid ${v['--c-accent']}` }} />
          <div style={{ height: 6, width: '50%', borderRadius: '1px 5px 5px 5px', background: v['--c-card'], border: `1px solid ${v['--c-border']}`, borderLeft: `2px solid ${v['--c-accent']}`, opacity: 0.7 }} />
        </div>
      </div>
      <div style={{
        marginTop: 5, height: 12, borderRadius: 5, background: v['--c-card'],
        border: `1px solid ${v['--c-accent']}`, boxShadow: `0 0 6px ${v['--c-glow']}`,
        display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px',
      }}>
        <div style={{ flex: 1, height: 2, background: v['--c-border'], borderRadius: 1 }} />
        <div style={{ width: 12, height: 8, borderRadius: 3, background: `linear-gradient(135deg, ${v['--c-accent2']}, ${v['--c-accent']})` }} />
      </div>
      <div style={{ marginTop: 8, textAlign: 'left' }}>
        <p style={{ color: v['--c-accent'], fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.12em', fontWeight: 700, lineHeight: 1 }}>
          {theme.name.toUpperCase()}
        </p>
        <p style={{ color: '#64748b', fontSize: '9px', marginTop: 2, lineHeight: 1 }}>{theme.subtitle}</p>
      </div>
      {active && (
        <div style={{
          position: 'absolute', top: 7, right: 7,
          width: 16, height: 16, borderRadius: '50%', background: v['--c-accent'],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 8px ${v['--c-glow-hi']}`,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={v['--c-bg']} strokeWidth="3.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </motion.button>
  );
}

function AppearanceTab({ local, setLocal, setSettings }) {
  const activeTheme = local?.theme || 'zeus';

  const selectTheme = (id) => {
    applyTheme(id);
    const updated = { ...local, theme: id };
    setLocal(updated);
    setSettings(updated);
    window.zeus?.saveSettings(updated);
  };

  const saveUi = (key, val) => {
    const updated = { ...local, ui: { ...(local.ui || {}), [key]: val } };
    setLocal(updated);
    setSettings(updated);
    window.zeus?.saveSettings(updated);
  };

  const ui = local?.ui || {};

  return (
    <div className="flex flex-col gap-5">
      {/* Theme picker */}
      <div>
        <p style={{ ...labelStyle, marginBottom: '14px' }}>SELECT THEME</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {Object.entries(THEMES).map(([id, theme]) => (
            <ThemeCard key={id} id={id} theme={theme} active={activeTheme === id} onSelect={selectTheme} />
          ))}
        </div>
      </div>

      {/* Active theme info */}
      <div className="rounded-xl p-3" style={cardStyle}>
        <div className="flex items-center gap-3">
          <div style={{ display: 'flex', gap: 5 }}>
            {THEMES[activeTheme].swatches.map((s, i) => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%', background: s,
                boxShadow: i === 0 ? `0 0 8px ${THEMES[activeTheme].vars['--c-glow-hi']}` : 'none',
                border: '1px solid rgba(255,255,255,0.1)',
              }} />
            ))}
          </div>
          <div>
            <p style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: '11px', letterSpacing: '0.1em', fontWeight: 700 }}>
              {THEMES[activeTheme].name.toUpperCase()}
            </p>
            <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: 2 }}>
              {THEMES[activeTheme].description} · Changes save instantly
            </p>
          </div>
        </div>
      </div>

      {/* ── Display Settings ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <p style={{ ...labelStyle, paddingBottom: '4px', borderBottom: '1px solid var(--c-border)' }}>
          DISPLAY SETTINGS
        </p>

        {/* Font size */}
        <div>
          <label style={labelStyle}>FONT SIZE</label>
          <PillSelect
            options={[['small', 'Sm'], ['medium', 'Md'], ['large', 'Lg'], ['xl', 'XL']]}
            value={ui.fontSize || 'medium'}
            onChange={v => saveUi('fontSize', v)}
          />
        </div>

        {/* Message density */}
        <div>
          <label style={labelStyle}>MESSAGE DENSITY</label>
          <PillSelect
            options={[['compact', 'Compact'], ['comfortable', 'Comfy'], ['spacious', 'Spacious']]}
            value={ui.messageDensity || 'comfortable'}
            onChange={v => saveUi('messageDensity', v)}
          />
        </div>

        {/* Animation speed */}
        <div>
          <label style={labelStyle}>ANIMATION SPEED</label>
          <PillSelect
            options={[['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow'], ['off', 'Off']]}
            value={ui.animationSpeed || 'normal'}
            onChange={v => saveUi('animationSpeed', v)}
          />
        </div>

        {/* Background pattern */}
        <div>
          <label style={labelStyle}>BACKGROUND PATTERN</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '8px' }}>
            {[['grid', 'Grid'], ['dots', 'Dots'], ['lines', 'Lines'], ['circuit', 'Circuit'], ['none', 'None']].map(([val, lbl]) => {
              const active = (ui.backgroundPattern || 'grid') === val;
              return (
                <button key={val} onClick={() => saveUi('backgroundPattern', val)} style={{
                  padding: '8px 4px',
                  background: active ? 'rgba(0,212,255,0.15)' : 'var(--c-card)',
                  border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  color: active ? 'var(--c-accent)' : 'var(--c-muted)',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '10px',
                  fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                }}>
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>

        {/* HUD compact */}
        <ToggleRow
          label="Compact HUD"
          desc="Reduce top bar height to save screen space"
          value={!!ui.hudCompact}
          onChange={v => saveUi('hudCompact', v)}
        />
      </div>
    </div>
  );
}

// ─── Password eye icon ────────────────────────────────────────────────────────
const EyeIcon = ({ show }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {show
      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
    }
  </svg>
);

function ApiKeyInput({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div className="flex items-center gap-2 mt-1.5">
        <input
          type={show ? 'text' : 'password'}
          className="api-key-input flex-1 rounded-lg px-3 py-2 text-sm"
          placeholder={placeholder || 'sk-...'}
          value={value}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="btn-icon w-8 h-8 rounded-lg flex-shrink-0"
          style={{ border: '1px solid var(--c-border)', color: show ? 'var(--c-accent)' : 'var(--c-muted)' }}
          onClick={() => setShow(!show)}
          title={show ? 'Hide' : 'Show'}
        >
          <EyeIcon show={show} />
        </button>
      </div>
    </div>
  );
}

function ProviderCard({ id, label, color, icon, active, onSelect }) {
  return (
    <button
      className="flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all"
      style={{
        background: active ? `rgba(${color}, 0.08)` : 'var(--c-card)',
        border: `1px solid ${active ? `rgba(${color}, 0.4)` : 'var(--c-border)'}`,
        boxShadow: active ? `0 0 12px rgba(${color}, 0.15)` : 'none',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(id)}
    >
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <div className="flex-1">
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 600 }}>{label}</p>
      </div>
      {active && <div className="status-dot online" />}
    </button>
  );
}

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic Claude', color: '229,140,105', icon: '🧠' },
  { id: 'openai',    label: 'OpenAI GPT',       color: '116,215,160', icon: '🤖' },
  { id: 'gemini',    label: 'Google Gemini',    color: '138,180,248', icon: '✨' },
  { id: 'ollama',    label: 'Ollama (Local)',   color: '168,218,181', icon: '🦙' },
];

export default function Settings() {
  const { settings, setSettings, setSettingsOpen, clearAllConversations } = useStore();

  const [local, setLocal] = useState(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab]     = useState('providers');
  const [memory, setMemory] = useState(null);

  useEffect(() => {
    if (settings) setLocal(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  useEffect(() => {
    if (tab === 'memory') window.zeus?.getMemory().then(setMemory).catch(() => {});
  }, [tab]);

  if (!local) return null;

  // ── Mutators ───────────────────────────────────────────────────────────────
  const setKey   = (p, k) => setLocal(l => ({ ...l, providers: { ...l.providers, [p]: { ...l.providers[p], apiKey: k } } }));
  const setModel = (p, m) => setLocal(l => ({ ...l, providers: { ...l.providers, [p]: { ...l.providers[p], model: m } } }));
  const setProvider    = id  => setLocal(l => ({ ...l, activeProvider: id }));
  const setChat        = (k, v) => setLocal(l => ({ ...l, chat:   { ...(l.chat   || {}), [k]: v } }));
  const setSystem      = (k, v) => setLocal(l => ({ ...l, system: { ...(l.system || {}), [k]: v } }));
  const setIntegration = (svc, k, v) => setLocal(l => ({
    ...l, integrations: { ...l.integrations, [svc]: { ...l.integrations?.[svc], [k]: v } },
  }));

  const save = async () => {
    if (window.zeus) await window.zeus.saveSettings(local);
    setSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const deleteMemoryEntry = async (category, id) => {
    const updated = { ...memory, [category]: memory[category].filter(e => e.id !== id) };
    setMemory(updated);
    await window.zeus?.saveMemory(updated);
  };

  const clearAllMemory = async () => {
    if (!confirm('Clear all persistent memory? Zeus will forget everything about you.')) return;
    const cleared = { facts: [], preferences: [], notes: [] };
    setMemory(cleared);
    await window.zeus?.saveMemory(cleared);
  };

  const TABS = [
    { id: 'providers',    label: 'Providers' },
    { id: 'models',       label: 'Models' },
    { id: 'chat',         label: 'AI' },
    { id: 'integrations', label: 'Links' },
    { id: 'memory',       label: 'Memory' },
    { id: 'behavior',     label: 'System' },
    { id: 'appearance',   label: 'Theme' },
    { id: 'about',        label: 'About' },
  ];

  return (
    <div className="flex flex-col h-full settings-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span className="font-orbitron font-bold tracking-wider text-sm" style={{ color: 'var(--c-accent)' }}>SETTINGS</span>
        </div>
        <button className="btn-icon w-7 h-7" onClick={() => setSettingsOpen(false)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-2 pt-2 gap-0.5 flex-shrink-0 flex-wrap" style={{ borderBottom: '1px solid var(--c-border)', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className="px-2.5 py-1.5 text-xs rounded-t-lg transition-all"
            style={{
              fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em', fontSize: '10px',
              color: tab === t.id ? 'var(--c-accent)' : 'var(--c-muted)',
              borderBottom: tab === t.id ? '2px solid var(--c-accent)' : '2px solid transparent',
              background: 'transparent', cursor: 'pointer',
            }}
            onClick={() => setTab(t.id)}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ═══ PROVIDERS ═══════════════════════════════════════════════════════ */}
        {tab === 'providers' && (
          <div className="flex flex-col gap-5">
            <div>
              <p style={{ ...labelStyle, marginBottom: '10px' }}>ACTIVE PROVIDER</p>
              <div className="flex flex-col gap-2">
                {PROVIDERS.map(p => (
                  <ProviderCard key={p.id} {...p} active={local.activeProvider === p.id} onSelect={setProvider} />
                ))}
              </div>
            </div>

            {/* Anthropic */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: '16px' }}>🧠</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Anthropic</span>
              </div>
              <ApiKeyInput label="API KEY" value={local.providers?.anthropic?.apiKey || ''} onChange={v => setKey('anthropic', v)} placeholder="sk-ant-..." />
            </div>

            {/* OpenAI */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: '16px' }}>🤖</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>OpenAI</span>
              </div>
              <ApiKeyInput label="API KEY" value={local.providers?.openai?.apiKey || ''} onChange={v => setKey('openai', v)} placeholder="sk-..." />
            </div>

            {/* Gemini */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: '16px' }}>✨</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Google Gemini</span>
              </div>
              <ApiKeyInput label="API KEY" value={local.providers?.gemini?.apiKey || ''} onChange={v => setKey('gemini', v)} placeholder="AIza..." />
            </div>

            {/* Ollama */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: '16px' }}>🦙</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Ollama</span>
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(168,218,181,0.12)', border: '1px solid rgba(168,218,181,0.3)', color: '#a8dab5', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', marginLeft: 'auto' }}>LOCAL</span>
              </div>
              <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginBottom: '10px' }}>No API key needed. Make sure Ollama is running locally.</p>
              <div className="mb-3">
                <label style={labelStyle}>BASE URL</label>
                <input type="text" className="api-key-input w-full rounded-lg px-3 py-2 text-sm mt-1.5"
                  placeholder="http://localhost:11434/v1"
                  value={local.providers?.ollama?.baseURL || 'http://localhost:11434/v1'}
                  onChange={e => setLocal(l => ({ ...l, providers: { ...l.providers, ollama: { ...l.providers?.ollama, baseURL: e.target.value } } }))}
                />
              </div>
              <div>
                <label style={labelStyle}>MODEL NAME</label>
                <input type="text" className="api-key-input w-full rounded-lg px-3 py-2 text-sm mt-1.5"
                  placeholder="llama3.2"
                  value={local.providers?.ollama?.model || ''}
                  onChange={e => setLocal(l => ({ ...l, providers: { ...l.providers, ollama: { ...l.providers?.ollama, model: e.target.value } } }))}
                />
                <p style={{ ...hintStyle, marginTop: '6px' }}>Popular: llama3.2 · mistral · qwen2.5 · phi4 · deepseek-r1 · gemma2</p>
                <p style={{ ...hintStyle, marginTop: '3px' }}>Tool calling: llama3.1, llama3.2, mistral-nemo, qwen2.5</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODELS ══════════════════════════════════════════════════════════ */}
        {tab === 'models' && (
          <OllamaManager
            settings={local}
            onModelSelect={name => {
              const updated = {
                ...local,
                activeProvider: 'ollama',
                providers: { ...local.providers, ollama: { ...local.providers?.ollama, model: name } },
              };
              setLocal(updated);
              setSettings(updated);
              window.zeus?.saveSettings(updated);
            }}
          />
        )}

        {/* ═══ CHAT / AI ═══════════════════════════════════════════════════════ */}
        {tab === 'chat' && (
          <div className="flex flex-col gap-4">
            {/* System prompt extra */}
            <div>
              <label style={labelStyle}>ADDITIONAL SYSTEM INSTRUCTIONS</label>
              <p style={descStyle}>Appended to Zeus's core prompt — be specific!</p>
              <textarea
                className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                rows={5}
                placeholder="Always respond in markdown. Be concise. Prefer bullet points. Always say 'sir'..."
                style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif' }}
                value={local.chat?.systemPromptExtra || ''}
                onChange={e => setChat('systemPromptExtra', e.target.value)}
              />
            </div>

            {/* Temperature */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <label style={labelStyle}>TEMPERATURE</label>
                  <p style={descStyle}>Controls creativity vs. precision</p>
                </div>
                <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: '16px', fontWeight: 700 }}>
                  {(local.chat?.temperature ?? 0.7).toFixed(2)}
                </span>
              </div>
              <input type="range" min="0" max="2" step="0.05"
                value={local.chat?.temperature ?? 0.7}
                onChange={e => setChat('temperature', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--c-accent)' }}
              />
              <div className="flex justify-between mt-1">
                <span style={hintStyle}>0 — Precise</span>
                <span style={hintStyle}>1 — Balanced</span>
                <span style={hintStyle}>2 — Wild</span>
              </div>
            </div>

            {/* Max tokens */}
            <div>
              <label style={labelStyle}>MAX RESPONSE TOKENS</label>
              <p style={descStyle}>Caps the length of each AI reply</p>
              <select
                className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                value={local.chat?.maxTokens ?? 4096}
                onChange={e => setChat('maxTokens', parseInt(e.target.value))}
                style={{ fontFamily: 'JetBrains Mono, monospace', background: 'var(--c-card)' }}
              >
                {[1024, 2048, 4096, 8192, 16384, 32768].map(n => (
                  <option key={n} value={n}>{n.toLocaleString()} tokens</option>
                ))}
              </select>
            </div>

            {/* Max context messages */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <label style={labelStyle}>CONTEXT WINDOW</label>
                  <p style={descStyle}>How many past messages the AI can see</p>
                </div>
                <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: '16px', fontWeight: 700 }}>
                  {local.chat?.maxContextMessages ?? 20}
                </span>
              </div>
              <input type="range" min="5" max="50" step="5"
                value={local.chat?.maxContextMessages ?? 20}
                onChange={e => setChat('maxContextMessages', parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--c-accent)' }}
              />
              <div className="flex justify-between mt-1">
                <span style={hintStyle}>5 — Cheap</span>
                <span style={hintStyle}>50 — Full history</span>
              </div>
            </div>

            {/* Response language */}
            <div>
              <label style={labelStyle}>RESPONSE LANGUAGE</label>
              <p style={descStyle}>Force Zeus to reply in a specific language</p>
              <select
                className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                value={local.chat?.responseLanguage || 'auto'}
                onChange={e => setChat('responseLanguage', e.target.value)}
                style={{ background: 'var(--c-card)' }}
              >
                <option value="auto">Auto-detect (default)</option>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Japanese">Japanese</option>
                <option value="Chinese">Chinese (Simplified)</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Arabic">Arabic</option>
                <option value="Russian">Russian</option>
                <option value="Korean">Korean</option>
                <option value="Italian">Italian</option>
                <option value="Dutch">Dutch</option>
              </select>
            </div>

            {/* Streaming */}
            <ToggleRow
              label="Streaming Responses"
              desc="Show text as it's generated (disable for batch output)"
              value={local.chat?.streamingEnabled !== false}
              onChange={v => setChat('streamingEnabled', v)}
            />
          </div>
        )}

        {/* ═══ SYSTEM / BEHAVIOR ═══════════════════════════════════════════════ */}
        {tab === 'behavior' && (
          <div className="flex flex-col gap-4">

            {/* Shell selector */}
            <div>
              <label style={labelStyle}>SHELL / TERMINAL</label>
              <p style={descStyle}>Used by Zeus to run system commands</p>
              <select
                className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                value={local.system?.shell || 'powershell'}
                onChange={e => setSystem('shell', e.target.value)}
                style={{ background: 'var(--c-card)' }}
              >
                <option value="powershell">PowerShell (Windows — recommended)</option>
                <option value="cmd">Command Prompt (cmd.exe)</option>
                <option value="bash">Bash (Git Bash)</option>
                <option value="wsl">WSL (Windows Subsystem for Linux)</option>
              </select>
            </div>

            {/* Always on top */}
            <ToggleRow
              label="Always on Top"
              desc="Zeus window stays above all other windows"
              value={!!local.system?.alwaysOnTop}
              onChange={v => setSystem('alwaysOnTop', v)}
            />

            {/* Launch at startup */}
            <ToggleRow
              label="Launch at Startup"
              desc="Start Zeus automatically when Windows boots"
              value={!!local.system?.launchAtStartup}
              onChange={v => setSystem('launchAtStartup', v)}
            />

            {/* Global hotkey */}
            <div>
              <label style={labelStyle}>GLOBAL HOTKEY</label>
              <p style={descStyle}>Focus Zeus from anywhere on your desktop</p>
              <input
                type="text"
                className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                placeholder="CommandOrControl+Shift+Space"
                value={local.system?.globalHotkey || 'CommandOrControl+Shift+Space'}
                onChange={e => setSystem('globalHotkey', e.target.value)}
              />
              <p style={{ ...hintStyle, marginTop: '5px' }}>Requires restart. Format: CommandOrControl+Shift+Z</p>
            </div>

            {/* Request timeout */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <label style={labelStyle}>REQUEST TIMEOUT</label>
                  <p style={descStyle}>Max wait time for AI responses</p>
                </div>
                <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: '16px', fontWeight: 700 }}>
                  {local.system?.requestTimeout ?? 60}s
                </span>
              </div>
              <input type="range" min="15" max="300" step="15"
                value={local.system?.requestTimeout ?? 60}
                onChange={e => setSystem('requestTimeout', parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--c-accent)' }}
              />
              <div className="flex justify-between mt-1">
                <span style={hintStyle}>15s</span>
                <span style={hintStyle}>5 min</span>
              </div>
            </div>

            {/* Clear chat on exit */}
            <ToggleRow
              label="Clear Chats on Exit"
              desc="Delete all conversations when Zeus closes"
              value={!!local.system?.clearChatOnExit}
              onChange={v => setSystem('clearChatOnExit', v)}
            />

            <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '4px' }} />

            {/* User name */}
            <div>
              <label style={labelStyle}>YOUR NAME</label>
              <p style={descStyle}>How Zeus addresses you</p>
              <input
                type="text" className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Sir"
                value={local.userName || ''}
                onChange={e => setLocal(l => ({ ...l, userName: e.target.value }))}
              />
            </div>

            {/* Tool confirmation */}
            <ToggleRow
              label="Confirm Before Writing/Deleting"
              desc="Show a dialog for destructive operations"
              value={!!local.requireToolConfirmation}
              onChange={v => setLocal(l => ({ ...l, requireToolConfirmation: v }))}
            />

            {/* Voice settings */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Voice Settings</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ color: 'var(--c-text)', fontSize: '12px' }}>Auto-speak responses</p>
                    <p style={{ color: 'var(--c-muted)', fontSize: '10px', marginTop: '2px' }}>Read AI responses aloud</p>
                  </div>
                  <Toggle value={!!local.voice?.autoSpeak} onChange={v => setLocal(l => ({ ...l, voice: { ...l.voice, autoSpeak: v } }))} />
                </div>
                <div>
                  <p style={{ ...hintStyle, marginBottom: '6px' }}>Speech Rate</p>
                  <input type="range" min="0.5" max="2" step="0.1"
                    value={local.voice?.rate || 1}
                    onChange={e => setLocal(l => ({ ...l, voice: { ...l.voice, rate: parseFloat(e.target.value) } }))}
                    style={{ width: '100%', accentColor: 'var(--c-accent)' }}
                  />
                  <div className="flex justify-between">
                    <span style={hintStyle}>Slow</span>
                    <span style={{ color: 'var(--c-accent)', fontSize: '10px' }}>{local.voice?.rate || 1}x</span>
                    <span style={hintStyle}>Fast</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Danger zone */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,51,102,0.05)', border: '1px solid rgba(255,51,102,0.2)' }}>
              <p style={{ color: 'var(--c-red)', fontSize: '12px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', marginBottom: '10px' }}>
                DANGER ZONE
              </p>
              <button
                className="w-full py-2 rounded-lg text-xs transition-all"
                style={{ background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.3)', color: 'var(--c-red)', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}
                onClick={() => { if (confirm('Delete ALL conversation history? This cannot be undone.')) clearAllConversations(); }}
              >
                CLEAR ALL CONVERSATIONS
              </button>
            </div>
          </div>
        )}

        {/* ═══ INTEGRATIONS ════════════════════════════════════════════════════ */}
        {tab === 'integrations' && (
          <div className="flex flex-col gap-5">
            {/* Telegram */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '18px' }}>✈️</span>
                  <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Telegram Bot</span>
                </div>
                <Toggle
                  value={!!local.integrations?.telegram?.enabled}
                  onChange={v => setIntegration('telegram', 'enabled', v)}
                />
              </div>
              <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginBottom: '10px' }}>
                Message Zeus from Telegram. Create a bot at @BotFather to get a token.
              </p>
              <ApiKeyInput
                label="BOT TOKEN"
                value={local.integrations?.telegram?.botToken || ''}
                onChange={v => setIntegration('telegram', 'botToken', v)}
                placeholder="1234567890:AAFF..."
              />
              {local.integrations?.telegram?.enabled && local.integrations?.telegram?.botToken && (
                <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
                  <p style={{ color: 'var(--c-green)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
                    BOT ACTIVE — POLLING TELEGRAM
                  </p>
                </div>
              )}
            </div>

            {/* GitHub */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: '18px' }}>🐙</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>GitHub</span>
                <span style={{ color: 'var(--c-muted)', fontSize: '10px', marginLeft: 'auto' }}>via http_request</span>
              </div>
              <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginBottom: '10px' }}>
                Zeus can access GitHub API (repos, issues, PRs, commits). Set a personal access token for private repos.
              </p>
              <ApiKeyInput
                label="PERSONAL ACCESS TOKEN"
                value={local.integrations?.github?.token || ''}
                onChange={v => setIntegration('github', 'token', v)}
                placeholder="ghp_..."
              />
            </div>

            {/* Spotify */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: '18px' }}>🎵</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Spotify</span>
                <span style={{ color: 'var(--c-muted)', fontSize: '10px', marginLeft: 'auto' }}>via http_request</span>
              </div>
              <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginBottom: '10px' }}>
                Control playback, search songs, get now playing. Paste a Spotify Web API access token.
              </p>
              <ApiKeyInput
                label="ACCESS TOKEN"
                value={local.integrations?.spotify?.accessToken || ''}
                onChange={v => setIntegration('spotify', 'accessToken', v)}
                placeholder="BQD..."
              />
            </div>

            {/* Weather */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: '18px' }}>🌤</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Weather</span>
                <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: 'var(--c-green)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
                  FREE · NO KEY
                </span>
              </div>
              <p style={{ color: 'var(--c-muted)', fontSize: '11px' }}>
                Powered by wttr.in — just ask Zeus for the weather anywhere. No setup required.
              </p>
            </div>

            {/* HTTP tip */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: '18px' }}>🔌</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Any API</span>
              </div>
              <p style={{ color: 'var(--c-muted)', fontSize: '11px' }}>
                Zeus has an <span style={{ color: 'var(--c-accent)' }}>http_request</span> tool that can call any REST API —
                Home Assistant, Philips Hue, Gmail, Slack, Discord, Notion, and more.
                Just tell Zeus the endpoint and it figures it out.
              </p>
            </div>
          </div>
        )}

        {/* ═══ MEMORY ══════════════════════════════════════════════════════════ */}
        {tab === 'memory' && (
          <div className="flex flex-col gap-4">
            <ToggleRow
              label="Persistent Memory"
              desc="Zeus remembers facts about you across all conversations"
              value={local.memory?.enabled !== false}
              onChange={v => setLocal(l => ({ ...l, memory: { ...l.memory, enabled: v } }))}
            />

            {memory && (
              <div className="flex gap-2">
                {[['facts', '🧠'], ['preferences', '❤️'], ['notes', '📝']].map(([cat, icon]) => (
                  <div key={cat} className="flex-1 rounded-xl p-3 text-center" style={cardStyle}>
                    <p style={{ fontSize: '20px' }}>{icon}</p>
                    <p style={{ color: 'var(--c-accent)', fontSize: '18px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, marginTop: '4px' }}>
                      {(memory[cat] || []).length}
                    </p>
                    <p style={{ color: 'var(--c-muted)', fontSize: '10px', textTransform: 'capitalize' }}>{cat}</p>
                  </div>
                ))}
              </div>
            )}

            {memory ? (
              ['facts', 'preferences', 'notes'].map(cat => {
                const entries = memory[cat] || [];
                if (!entries.length) return null;
                return (
                  <div key={cat}>
                    <p style={{ ...labelStyle, marginBottom: '8px' }}>{cat.toUpperCase()}</p>
                    <div className="flex flex-col gap-1.5">
                      {entries.map(e => (
                        <div key={e.id} className="flex items-start gap-2 rounded-lg px-3 py-2" style={cardStyle}>
                          <div className="flex-1 min-w-0">
                            {e.key && <span style={{ color: 'var(--c-accent)', fontSize: '11px', fontWeight: 600, marginRight: 6 }}>{e.key}:</span>}
                            <span style={{ color: 'var(--c-dim)', fontSize: '12px' }}>{e.value}</span>
                          </div>
                          <button className="btn-icon w-5 h-5 flex-shrink-0" onClick={() => deleteMemoryEntry(cat, e.id)} title="Delete">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center py-8">
                <span style={{ color: 'var(--c-muted)', fontSize: '12px' }}>Loading memory...</span>
              </div>
            )}

            {memory && Object.values(memory).every(v => !Array.isArray(v) || v.length === 0) && (
              <div className="flex flex-col items-center py-10 gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--c-muted)' }}>
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                </svg>
                <p style={{ color: 'var(--c-muted)', fontSize: '12px', textAlign: 'center' }}>
                  No memories yet. Zeus will automatically remember important things you share.
                </p>
              </div>
            )}

            {memory && Object.values(memory).some(v => Array.isArray(v) && v.length > 0) && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,51,102,0.05)', border: '1px solid rgba(255,51,102,0.2)' }}>
                <button
                  className="w-full py-2 rounded-lg text-xs transition-all"
                  style={{ background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.3)', color: 'var(--c-red)', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}
                  onClick={clearAllMemory}
                >
                  CLEAR ALL MEMORY
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ APPEARANCE ══════════════════════════════════════════════════════ */}
        {tab === 'appearance' && (
          <AppearanceTab
            local={local}
            setLocal={setLocal}
            setSettings={setSettings}
          />
        )}

        {/* ═══ ABOUT ═══════════════════════════════════════════════════════════ */}
        {tab === 'about' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d1f3c, #0a1628)', border: '1px solid var(--c-border-hi)', boxShadow: '0 0 30px rgba(0,212,255,0.2)' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="bolt-icon">
                  <path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z" fill="url(#about-bolt)" />
                  <defs>
                    <linearGradient id="about-bolt" x1="4" y1="2" x2="20" y2="22">
                      <stop offset="0%" stopColor="#00d4ff"/>
                      <stop offset="100%" stopColor="#0066cc"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="text-center">
                <p className="font-orbitron font-bold tracking-widest glow-text" style={{ color: 'var(--c-accent)', fontSize: '20px' }}>ZEUS AI</p>
                <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: '4px' }}>Advanced Computer Assistant · v1.0.0</p>
              </div>
            </div>

            <div className="rounded-xl p-4" style={cardStyle}>
              <p style={{ ...labelStyle, marginBottom: '12px' }}>CAPABILITIES</p>
              {[
                ['🖥', 'PC Control', 'Open apps, manage files, run commands'],
                ['🧠', 'Multi-AI',   'Anthropic Claude, OpenAI GPT, Google Gemini, Ollama'],
                ['📸', 'Vision',     'Take screenshots and capture screen'],
                ['🎤', 'Voice',      'Speech-to-text and text-to-speech'],
                ['⚡', 'Tools',     '30+ built-in PC control & automation tools'],
                ['💾', 'Memory',    'Persistent memory across all conversations'],
                ['✈️', 'Telegram',  'Message Zeus from anywhere via Telegram'],
                ['</>', 'Code Agent','Autonomous coding tasks in any directory'],
              ].map(([icon, title, desc]) => (
                <div key={title} className="flex items-start gap-3 mb-3">
                  <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                  <div>
                    <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 500 }}>{title}</p>
                    <p style={{ color: 'var(--c-muted)', fontSize: '11px' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4" style={cardStyle}>
              <p style={{ ...labelStyle, marginBottom: '10px' }}>KEYBOARD SHORTCUTS</p>
              {[
                ['Enter', 'Send message'],
                ['Shift+Enter', 'New line'],
                ['Esc', 'Close settings'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between mb-2">
                  <span style={{ color: 'var(--c-dim)', fontSize: '12px' }}>{desc}</span>
                  <kbd style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '4px', padding: '2px 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--c-accent)' }}>
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save footer — shown for tabs with form fields that aren't auto-save */}
      {['providers', 'chat', 'integrations', 'behavior'].includes(tab) && (
        <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--c-border)' }}>
          <motion.button
            className="w-full btn-primary rounded-xl py-2.5 text-sm font-orbitron tracking-wider"
            style={{ fontSize: '12px' }}
            onClick={save}
            whileTap={{ scale: 0.97 }}
          >
            {saved ? '✓ SAVED' : 'SAVE SETTINGS'}
          </motion.button>
        </div>
      )}
    </div>
  );
}
