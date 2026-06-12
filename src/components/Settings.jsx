import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore.js';
import { THEMES, applyTheme } from '../themes.js';
import OllamaManager from './OllamaManager.jsx';
import KnowledgePanel from './KnowledgePanel.jsx';
import UpdatePanel from './UpdatePanel.jsx';

// ─── Shared style helpers ──────────────────────────────────────────────────────
const labelStyle = {
  color: 'var(--c-muted)', fontSize: '10px',
  fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em',
};
const hintStyle = { color: 'var(--c-muted)', fontSize: '10px', lineHeight: 1.5 };

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3" style={{ paddingBottom: 8, borderBottom: '1px solid var(--c-border)' }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        background: 'var(--c-glow)', border: '1px solid rgba(0,212,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: '10px', letterSpacing: '0.15em', fontWeight: 700 }}>
        {label}
      </span>
    </div>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      className="relative rounded-full flex-shrink-0"
      style={{
        width: 42, height: 24,
        background: value
          ? 'linear-gradient(135deg, var(--c-accent2), var(--c-accent))'
          : 'var(--c-border)',
        boxShadow: value ? '0 0 12px var(--c-glow-hi)' : 'none',
        cursor: 'pointer', border: 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}
      onClick={() => onChange(!value)}
    >
      <div style={{
        position: 'absolute', width: 18, height: 18,
        borderRadius: '50%', top: 3,
        left: value ? 21 : 3,
        background: value ? '#080c14' : 'var(--c-muted)',
        transition: 'left 0.2s, background 0.2s',
      }} />
    </button>
  );
}

function ToggleRow({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl" style={{
      background: 'var(--c-card)', border: '1px solid var(--c-border)',
    }}>
      <div className="flex-1 pr-4">
        <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 500 }}>{label}</p>
        {desc && <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: 2 }}>{desc}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

// ─── Pill selector ─────────────────────────────────────────────────────────────
function PillSelect({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5 mt-2">
      {options.map(([val, lbl]) => {
        const active = value === val;
        return (
          <button key={val} onClick={() => onChange(val)} style={{
            flex: 1, padding: '6px 4px',
            background: active ? 'var(--c-glow)' : 'var(--c-card)',
            border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
            color: active ? 'var(--c-accent)' : 'var(--c-muted)',
            borderRadius: 8, cursor: 'pointer', fontSize: '10px',
            fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em',
            transition: 'all 0.15s',
            boxShadow: active ? '0 0 8px var(--c-glow)' : 'none',
          }}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

// ─── Theme preview card ────────────────────────────────────────────────────────
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
        borderRadius: 12, padding: 10, cursor: 'pointer',
        position: 'relative', overflow: 'hidden',
        boxShadow: active ? `0 0 20px ${v['--c-glow-hi']}, 0 0 40px ${v['--c-glow']}` : 'none',
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
          <div style={{ height: 9, width: '58%', borderRadius: '5px 1px 5px 5px', background: v['--c-card'], border: `1px solid ${v['--c-border-hi']}`, borderRight: `2px solid ${v['--c-accent']}` }} />
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
      <SectionHeader
        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>}
        label="SELECT THEME"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {Object.entries(THEMES).map(([id, theme]) => (
          <ThemeCard key={id} id={id} theme={theme} active={activeTheme === id} onSelect={selectTheme} />
        ))}
      </div>

      {/* Active theme swatch row */}
      <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {THEMES[activeTheme].swatches.map((s, i) => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%', background: s,
              boxShadow: i === 0 ? `0 0 8px ${THEMES[activeTheme].vars['--c-glow-hi']}` : 'none',
              border: '1px solid rgba(255,255,255,0.1)',
            }} />
          ))}
        </div>
        <div>
          <p style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: '10px', letterSpacing: '0.1em', fontWeight: 700 }}>
            {THEMES[activeTheme].name.toUpperCase()}
          </p>
          <p style={{ color: 'var(--c-muted)', fontSize: '10px', marginTop: 1 }}>
            {THEMES[activeTheme].description} · Changes save instantly
          </p>
        </div>
      </div>

      <SectionHeader
        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
        label="DISPLAY"
      />

      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>FONT SIZE</label>
          <PillSelect options={[['small','Sm'],['medium','Md'],['large','Lg'],['xl','XL']]} value={ui.fontSize||'medium'} onChange={v=>saveUi('fontSize',v)} />
        </div>
        <div>
          <label style={labelStyle}>MESSAGE DENSITY</label>
          <PillSelect options={[['compact','Compact'],['comfortable','Comfy'],['spacious','Spacious']]} value={ui.messageDensity||'comfortable'} onChange={v=>saveUi('messageDensity',v)} />
        </div>
        <div>
          <label style={labelStyle}>ANIMATION SPEED</label>
          <PillSelect options={[['fast','Fast'],['normal','Normal'],['slow','Slow'],['off','Off']]} value={ui.animationSpeed||'normal'} onChange={v=>saveUi('animationSpeed',v)} />
        </div>
        <div>
          <label style={labelStyle}>BACKGROUND PATTERN</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
            {[['grid','Grid'],['dots','Dots'],['lines','Lines'],['circuit','Circuit'],['diagonal','Diagonal'],['crosshatch','Cross'],['mesh','Aurora'],['carbon','Carbon'],['scanlines','CRT'],['waves','Waves'],['starfield','Stars'],['none','None']].map(([val,lbl]) => {
              const active = (ui.backgroundPattern||'grid') === val;
              return (
                <button key={val} onClick={() => saveUi('backgroundPattern', val)} style={{
                  padding: '8px 4px',
                  background: active ? 'var(--c-glow)' : 'var(--c-card)',
                  border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  color: active ? 'var(--c-accent)' : 'var(--c-muted)',
                  borderRadius: 8, cursor: 'pointer', fontSize: '10px',
                  fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                  boxShadow: active ? '0 0 8px var(--c-glow)' : 'none',
                }}>{lbl}</button>
              );
            })}
          </div>
        </div>
        <ToggleRow label="Compact HUD" desc="Reduce top bar height to save screen space" value={!!ui.hudCompact} onChange={v=>saveUi('hudCompact',v)} />
        <div style={{ marginTop: 18, borderTop: '1px solid var(--c-border)', paddingTop: 18 }}>
          <KnowledgePanel />
        </div>
        <div style={{ marginTop: 18, borderTop: '1px solid var(--c-border)', paddingTop: 18 }}>
          <UpdatePanel />
        </div>
      </div>
    </div>
  );
}

// ─── API Key field ─────────────────────────────────────────────────────────────
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
      {label && <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>{label}</label>}
      <div className="flex items-center gap-2">
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
        >
          <EyeIcon show={show} />
        </button>
      </div>
    </div>
  );
}

// ─── Provider card ─────────────────────────────────────────────────────────────
const PROVIDER_META = {
  anthropic: { label: 'Anthropic Claude', rgb: '229,140,105', icon: '🧠', hint: 'Most capable · Best for coding & reasoning' },
  openai:    { label: 'OpenAI GPT',       rgb: '116,215,160', icon: '🤖', hint: 'Versatile · Great tool calling' },
  gemini:    { label: 'Google Gemini',    rgb: '138,180,248', icon: '✨', hint: 'Fast · Large context window' },
  ollama:    { label: 'Ollama (Local)',   rgb: '168,218,181', icon: '🦙', hint: 'Private · No API key · Runs offline' },
};

function ProviderCard({ id, active, onSelect }) {
  const m = PROVIDER_META[id];
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-3 w-full p-3 rounded-xl text-left"
      style={{
        background: active ? `rgba(${m.rgb}, 0.07)` : 'var(--c-card)',
        border: `1px solid ${active ? `rgba(${m.rgb}, 0.45)` : 'var(--c-border)'}`,
        boxShadow: active ? `0 0 16px rgba(${m.rgb}, 0.12), inset 0 0 20px rgba(${m.rgb}, 0.04)` : 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderLeft: active ? `3px solid rgb(${m.rgb})` : '3px solid transparent',
      }}
      onClick={() => onSelect(id)}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
      <div className="flex-1 min-w-0">
        <p style={{ color: active ? `rgb(${m.rgb})` : 'var(--c-text)', fontSize: '13px', fontWeight: 600, transition: 'color 0.2s' }}>{m.label}</p>
        <p style={{ color: 'var(--c-muted)', fontSize: '10px', marginTop: 1 }}>{m.hint}</p>
      </div>
      {active && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: `rgb(${m.rgb})`, boxShadow: `0 0 6px rgb(${m.rgb})`, animation: 'blink 2s infinite' }} />
          <span style={{ color: `rgb(${m.rgb})`, fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>ACTIVE</span>
        </div>
      )}
    </motion.button>
  );
}

// ─── Slider row ────────────────────────────────────────────────────────────────
function SliderRow({ label, desc, min, max, step, value, onChange, format, hints }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <label style={labelStyle}>{label}</label>
          {desc && <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: 2 }}>{desc}</p>}
        </div>
        <span style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: '15px', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', accentColor: 'var(--c-accent)', cursor: 'pointer' }}
      />
      {hints && (
        <div className="flex justify-between mt-1">
          {hints.map((h, i) => <span key={i} style={hintStyle}>{h}</span>)}
        </div>
      )}
    </div>
  );
}

// ─── Nav icons ─────────────────────────────────────────────────────────────────
const NavIcons = {
  providers: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  models:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  chat:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  integrations:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  memory:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  behavior:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  appearance:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
  about:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

const TABS = [
  { id: 'providers',    label: 'Providers' },
  { id: 'models',       label: 'Models' },
  { id: 'chat',         label: 'AI Chat' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'memory',       label: 'Memory' },
  { id: 'behavior',     label: 'System' },
  { id: 'appearance',   label: 'Theme' },
  { id: 'about',        label: 'About' },
];

// ─── Main Settings component ───────────────────────────────────────────────────
export default function Settings() {
  const { settings, setSettings, setSettingsOpen, clearAllConversations } = useStore();
  const [local, setLocal]   = useState(null);
  const [saved, setSaved]   = useState(false);
  const [tab, setTab]       = useState('providers');
  const [memory, setMemory] = useState(null);

  useEffect(() => {
    if (settings) setLocal(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  useEffect(() => {
    if (tab === 'memory') window.zeus?.getMemory().then(setMemory).catch(() => {});
  }, [tab]);

  if (!local) return null;

  // ── Mutators ────────────────────────────────────────────────────────────────
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

  const needsSave = ['providers', 'chat', 'integrations', 'behavior'].includes(tab);

  return (
    <div className="flex flex-col h-full settings-panel overflow-hidden" style={{ position: 'relative' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, var(--c-surface) 0%, var(--c-bg) 100%)',
        borderBottom: '1px solid var(--c-border)',
      }}>
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--c-accent2), var(--c-accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px var(--c-glow-hi)',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#080c14" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <div>
            <p className="font-orbitron font-bold tracking-widest" style={{ color: 'var(--c-accent)', fontSize: '11px', letterSpacing: '0.18em' }}>ZEUS SETTINGS</p>
            <p style={{ color: 'var(--c-muted)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', marginTop: 1 }}>
              {TABS.find(t => t.id === tab)?.label?.toUpperCase()}
            </p>
          </div>
        </div>
        <button className="btn-icon w-7 h-7 rounded-lg" onClick={() => setSettingsOpen(false)}
          style={{ border: '1px solid var(--c-border)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Body: sidebar nav + content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar nav */}
        <div className="flex flex-col py-2 flex-shrink-0" style={{
          width: 108,
          background: 'rgba(0,0,0,0.25)',
          borderRight: '1px solid var(--c-border)',
          gap: 1,
        }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5, padding: '10px 4px', cursor: 'pointer', border: 'none',
                position: 'relative',
                background: active ? 'rgba(0,212,255,0.07)' : 'transparent',
                color: active ? 'var(--c-accent)' : 'var(--c-muted)',
                transition: 'all 0.15s',
                borderRight: active ? '2px solid var(--c-accent)' : '2px solid transparent',
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background='rgba(0,212,255,0.04)'; e.currentTarget.style.color='var(--c-dim)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--c-muted)'; } }}
              >
                {NavIcons[t.id]}
                <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.2, fontWeight: active ? 700 : 400 }}>
                  {t.label.toUpperCase()}
                </span>
                {active && (
                  <motion.div
                    layoutId="tab-glow"
                    style={{
                      position: 'absolute', right: 0, top: '20%', bottom: '20%',
                      width: 2, borderRadius: 2,
                      background: 'var(--c-accent)',
                      boxShadow: '0 0 8px var(--c-accent)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4" style={{ minWidth: 0 }}>

          {/* ═══ PROVIDERS ═════════════════════════════════════════════════════ */}
          {tab === 'providers' && (
            <div className="flex flex-col gap-4">
              <SectionHeader
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>}
                label="ACTIVE PROVIDER"
              />
              <div className="flex flex-col gap-2">
                {['anthropic','openai','gemini','ollama'].map(id => (
                  <ProviderCard key={id} id={id} active={local.activeProvider === id} onSelect={setProvider} />
                ))}
              </div>

              {/* ── Anthropic ── */}
              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid rgba(229,140,105,0.25)', borderLeft: '2px solid rgb(229,140,105)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 16 }}>🧠</span>
                  <span style={{ color: 'rgb(229,140,105)', fontWeight: 600, fontSize: '13px' }}>Anthropic</span>
                  <span style={{ color: 'var(--c-muted)', fontSize: '10px', marginLeft: 'auto' }}>claude.ai</span>
                </div>
                <ApiKeyInput label="API KEY" value={local.providers?.anthropic?.apiKey || ''} onChange={v => setKey('anthropic', v)} placeholder="sk-ant-..." />
              </div>

              {/* ── OpenAI ── */}
              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid rgba(116,215,160,0.25)', borderLeft: '2px solid rgb(116,215,160)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 16 }}>🤖</span>
                  <span style={{ color: 'rgb(116,215,160)', fontWeight: 600, fontSize: '13px' }}>OpenAI</span>
                  <span style={{ color: 'var(--c-muted)', fontSize: '10px', marginLeft: 'auto' }}>platform.openai.com</span>
                </div>
                <ApiKeyInput label="API KEY" value={local.providers?.openai?.apiKey || ''} onChange={v => setKey('openai', v)} placeholder="sk-..." />
              </div>

              {/* ── Gemini ── */}
              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid rgba(138,180,248,0.25)', borderLeft: '2px solid rgb(138,180,248)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 16 }}>✨</span>
                  <span style={{ color: 'rgb(138,180,248)', fontWeight: 600, fontSize: '13px' }}>Google Gemini</span>
                  <span style={{ color: 'var(--c-muted)', fontSize: '10px', marginLeft: 'auto' }}>aistudio.google.com</span>
                </div>
                <ApiKeyInput label="API KEY" value={local.providers?.gemini?.apiKey || ''} onChange={v => setKey('gemini', v)} placeholder="AIza..." />
              </div>

              {/* ── Ollama ── */}
              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid rgba(168,218,181,0.25)', borderLeft: '2px solid rgb(168,218,181)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 16 }}>🦙</span>
                  <span style={{ color: 'rgb(168,218,181)', fontWeight: 600, fontSize: '13px' }}>Ollama</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,218,181,0.1)', border: '1px solid rgba(168,218,181,0.3)', color: 'rgb(168,218,181)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', marginLeft: 'auto' }}>LOCAL</span>
                </div>
                <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginBottom: 10 }}>No API key needed. Runs 100% offline on your machine.</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>BASE URL</label>
                    <input type="text" className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                      placeholder="http://localhost:11434/v1"
                      value={local.providers?.ollama?.baseURL || 'http://localhost:11434/v1'}
                      onChange={e => setLocal(l => ({ ...l, providers: { ...l.providers, ollama: { ...l.providers?.ollama, baseURL: e.target.value } } }))}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>MODEL NAME</label>
                    <input type="text" className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                      placeholder="llama3.2"
                      value={local.providers?.ollama?.model || ''}
                      onChange={e => setLocal(l => ({ ...l, providers: { ...l.providers, ollama: { ...l.providers?.ollama, model: e.target.value } } }))}
                    />
                    <p style={{ ...hintStyle, marginTop: 5 }}>Tool calling: llama3.2 · mistral-nemo · qwen2.5 · firefunction-v2</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ MODELS ════════════════════════════════════════════════════════ */}
          {tab === 'models' && (
            <OllamaManager
              settings={local}
              onModelSelect={name => {
                const updated = { ...local, activeProvider: 'ollama', providers: { ...local.providers, ollama: { ...local.providers?.ollama, model: name } } };
                setLocal(updated); setSettings(updated); window.zeus?.saveSettings(updated);
              }}
            />
          )}

          {/* ═══ AI CHAT ═══════════════════════════════════════════════════════ */}
          {tab === 'chat' && (
            <div className="flex flex-col gap-4">
              <SectionHeader
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                label="PERSONALITY"
              />
              <div>
                <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>ADDITIONAL SYSTEM INSTRUCTIONS</label>
                <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginBottom: 8 }}>Appended to Zeus's core prompt. Be specific and concise.</p>
                <textarea className="api-key-input w-full rounded-lg px-3 py-2 text-sm" rows={4}
                  placeholder={`Always respond in markdown. Be concise. Prefer bullet points...`}
                  style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif' }}
                  value={local.chat?.systemPromptExtra || ''}
                  onChange={e => setChat('systemPromptExtra', e.target.value)}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>YOUR NAME</label>
                <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginBottom: 8 }}>How Zeus addresses you</p>
                <input type="text" className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="Sir"
                  value={local.userName || ''}
                  onChange={e => setLocal(l => ({ ...l, userName: e.target.value }))}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 4 }} />
              <SectionHeader
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
                label="GENERATION"
              />

              <SliderRow label="TEMPERATURE" desc="Creativity vs precision" min={0} max={2} step={0.05}
                value={local.chat?.temperature ?? 0.7}
                onChange={v => setChat('temperature', parseFloat(v))}
                format={v => (+v).toFixed(2)}
                hints={['0 · Precise', '1 · Balanced', '2 · Wild']}
              />

              <div>
                <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>MAX RESPONSE TOKENS</label>
                <select className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                  value={local.chat?.maxTokens ?? 4096}
                  onChange={e => setChat('maxTokens', parseInt(e.target.value))}
                  style={{ background: 'var(--c-card)' }}
                  disabled={!!local.chat?.unlimitedTokens}
                >
                  {[1024,2048,4096,8192,16384,32768].map(n => <option key={n} value={n}>{n.toLocaleString()} tokens</option>)}
                </select>
              </div>

              <ToggleRow label="Unlimited Tokens (Ollama)" desc="Removes the token cap for local models — lets them generate as long as needed" value={!!local.chat?.unlimitedTokens} onChange={v => setChat('unlimitedTokens', v)} />

              <SliderRow label="CONTEXT WINDOW" desc="Past messages the AI can see" min={5} max={50} step={5}
                value={local.chat?.maxContextMessages ?? 20}
                onChange={v => setChat('maxContextMessages', parseInt(v))}
                hints={['5 · Cheap', '20 · Default', '50 · Full history']}
              />

              <div>
                <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>RESPONSE LANGUAGE</label>
                <select className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                  value={local.chat?.responseLanguage || 'auto'}
                  onChange={e => setChat('responseLanguage', e.target.value)}
                  style={{ background: 'var(--c-card)' }}
                >
                  <option value="auto">Auto-detect (default)</option>
                  {['English','Spanish','French','German','Japanese','Chinese (Simplified)','Portuguese','Arabic','Russian','Korean','Italian','Dutch'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <ToggleRow label="Streaming Responses" desc="Show text as it's generated (disable for batch output)" value={local.chat?.streamingEnabled !== false} onChange={v => setChat('streamingEnabled', v)} />
            </div>
          )}

          {/* ═══ SYSTEM / BEHAVIOR ═════════════════════════════════════════════ */}
          {tab === 'behavior' && (
            <div className="flex flex-col gap-4">
              <SectionHeader
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>}
                label="SHELL & COMMANDS"
              />
              <div>
                <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>DEFAULT SHELL</label>
                <select className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                  value={local.system?.shell || 'powershell'}
                  onChange={e => setSystem('shell', e.target.value)}
                  style={{ background: 'var(--c-card)' }}
                >
                  <option value="powershell">PowerShell (recommended)</option>
                  <option value="cmd">Command Prompt (cmd.exe)</option>
                  <option value="bash">Bash (Git Bash)</option>
                  <option value="wsl">WSL (Windows Subsystem for Linux)</option>
                </select>
              </div>

              <SliderRow label="REQUEST TIMEOUT" desc="Max wait time per AI response" min={15} max={300} step={15}
                value={local.system?.requestTimeout ?? 60}
                onChange={v => setSystem('requestTimeout', parseInt(v))}
                format={v => `${v}s`}
                hints={['15s', '60s default', '5 min']}
              />

              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 4 }} />
              <SectionHeader
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>}
                label="WINDOW"
              />

              <ToggleRow label="Always on Top" desc="Zeus window stays above all other windows" value={!!local.system?.alwaysOnTop} onChange={v => setSystem('alwaysOnTop', v)} />
              <ToggleRow label="Launch at Startup" desc="Start Zeus automatically when Windows boots" value={!!local.system?.launchAtStartup} onChange={v => setSystem('launchAtStartup', v)} />
              <ToggleRow label="Clear Chats on Exit" desc="Delete all conversations when Zeus closes" value={!!local.system?.clearChatOnExit} onChange={v => setSystem('clearChatOnExit', v)} />

              <div>
                <label style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>GLOBAL HOTKEY</label>
                <input type="text" className="api-key-input w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="CommandOrControl+Shift+Space"
                  value={local.system?.globalHotkey || ''}
                  onChange={e => setSystem('globalHotkey', e.target.value)}
                />
                <p style={{ ...hintStyle, marginTop: 5 }}>Requires restart. Focuses Zeus from anywhere.</p>
              </div>

              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 4 }} />
              <SectionHeader
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
                label="VOICE"
              />

              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 500 }}>Auto-speak responses</p>
                      <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: 2 }}>Read AI responses aloud</p>
                    </div>
                    <Toggle value={!!local.voice?.autoSpeak} onChange={v => setLocal(l => ({ ...l, voice: { ...l.voice, autoSpeak: v } }))} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <p style={hintStyle}>Speech Rate</p>
                      <p style={{ color: 'var(--c-accent)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif' }}>{local.voice?.rate || 1}×</p>
                    </div>
                    <input type="range" min="0.5" max="2" step="0.1"
                      value={local.voice?.rate || 1}
                      onChange={e => setLocal(l => ({ ...l, voice: { ...l.voice, rate: parseFloat(e.target.value) } }))}
                      style={{ width: '100%', accentColor: 'var(--c-accent)' }}
                    />
                    <div className="flex justify-between"><span style={hintStyle}>Slow</span><span style={hintStyle}>Fast</span></div>
                  </div>
                </div>
              </div>

              <ToggleRow label="Confirm Before Destructive Actions" desc="Show dialog for file writes, deletions, and commands" value={!!local.requireToolConfirmation} onChange={v => setLocal(l => ({ ...l, requireToolConfirmation: v }))} />

              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 4 }} />

              <div className="rounded-xl p-4" style={{ background: 'rgba(255,51,102,0.04)', border: '1px solid rgba(255,51,102,0.2)' }}>
                <p style={{ color: 'var(--c-red)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', marginBottom: 10 }}>DANGER ZONE</p>
                <button
                  className="w-full py-2 rounded-lg text-xs transition-all"
                  style={{ background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.3)', color: 'var(--c-red)', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}
                  onClick={() => { if (confirm('Delete ALL conversation history? This cannot be undone.')) clearAllConversations(); }}
                >
                  CLEAR ALL CONVERSATIONS
                </button>
              </div>
            </div>
          )}

          {/* ═══ INTEGRATIONS ══════════════════════════════════════════════════ */}
          {tab === 'integrations' && (
            <div className="flex flex-col gap-4">
              <SectionHeader
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
                label="CONNECTED SERVICES"
              />

              {/* Telegram */}
              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 18 }}>✈️</span>
                    <div>
                      <p style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Telegram Bot</p>
                      <p style={{ color: 'var(--c-muted)', fontSize: '10px' }}>Message Zeus from anywhere</p>
                    </div>
                  </div>
                  <Toggle value={!!local.integrations?.telegram?.enabled} onChange={v => setIntegration('telegram', 'enabled', v)} />
                </div>
                <ApiKeyInput label="BOT TOKEN" value={local.integrations?.telegram?.botToken || ''} onChange={v => setIntegration('telegram', 'botToken', v)} placeholder="1234567890:AAFF..." />
                {local.integrations?.telegram?.enabled && local.integrations?.telegram?.botToken && (
                  <div className="mt-3 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
                    <div className="status-dot online" />
                    <p style={{ color: 'var(--c-green)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>BOT ACTIVE · POLLING</p>
                  </div>
                )}
              </div>

              {/* GitHub */}
              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 18 }}>🐙</span>
                  <div>
                    <p style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>GitHub</p>
                    <p style={{ color: 'var(--c-muted)', fontSize: '10px' }}>Repos, issues, PRs, commits</p>
                  </div>
                </div>
                <ApiKeyInput label="PERSONAL ACCESS TOKEN" value={local.integrations?.github?.token || ''} onChange={v => setIntegration('github', 'token', v)} placeholder="ghp_..." />
              </div>

              {/* Spotify */}
              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 18 }}>🎵</span>
                  <div>
                    <p style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '13px' }}>Spotify</p>
                    <p style={{ color: 'var(--c-muted)', fontSize: '10px' }}>Playback control, search, now playing</p>
                  </div>
                </div>
                <ApiKeyInput label="ACCESS TOKEN" value={local.integrations?.spotify?.accessToken || ''} onChange={v => setIntegration('spotify', 'accessToken', v)} placeholder="BQD..." />
              </div>

              {/* Free services */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 14 }}>🌤</span>
                  <p style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '12px' }}>Weather</p>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: 'var(--c-green)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>FREE · NO KEY</span>
                </div>
                <p style={{ color: 'var(--c-muted)', fontSize: '10px' }}>Powered by wttr.in — just ask Zeus for the weather anywhere.</p>
              </div>

              <div className="rounded-xl p-3" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 14 }}>🔌</span>
                  <p style={{ color: 'var(--c-text)', fontWeight: 600, fontSize: '12px' }}>Any REST API</p>
                </div>
                <p style={{ color: 'var(--c-muted)', fontSize: '10px', lineHeight: 1.55 }}>
                  Zeus has an <span style={{ color: 'var(--c-accent)' }}>http_request</span> tool that can call any API — Home Assistant, Slack, Notion, Discord, and more.
                </p>
              </div>
            </div>
          )}

          {/* ═══ MEMORY ════════════════════════════════════════════════════════ */}
          {tab === 'memory' && (() => {
            // Derive real categories from whatever keys Zeus has stored
            const categories = memory
              ? Object.keys(memory).filter(k => Array.isArray(memory[k]) && memory[k].length > 0)
              : [];
            const totalEntries = categories.reduce((sum, k) => sum + memory[k].length, 0);
            const CAT_ICONS = {
              fact: '🧠', facts: '🧠',
              preference: '❤️', preferences: '❤️',
              note: '📝', notes: '📝',
              project: '📁', task: '✅',
              code: '⚡', person: '👤',
            };
            const CAT_COLORS = {
              fact: '0,212,255', facts: '0,212,255',
              preference: '229,140,105', preferences: '229,140,105',
              note: '168,85,247', notes: '168,85,247',
              project: '116,215,160', task: '255,204,0',
              code: '0,255,136', person: '138,180,248',
            };
            const getColor = k => CAT_COLORS[k] || '100,116,139';
            const getIcon  = k => CAT_ICONS[k]  || '💾';

            return (
              <div className="flex flex-col gap-4">
                <SectionHeader
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>}
                  label="PERSISTENT MEMORY"
                />

                <ToggleRow label="Persistent Memory" desc="Zeus remembers facts about you across all conversations" value={local.memory?.enabled !== false} onChange={v => setLocal(l => ({ ...l, memory: { ...l.memory, enabled: v } }))} />

                {/* Stats bar — accurate totals from real data */}
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
                  <div className="flex" style={{ background: 'var(--c-card)' }}>
                    {/* Total count */}
                    <div className="flex-1 flex flex-col items-center py-4" style={{ borderRight: '1px solid var(--c-border)' }}>
                      {memory ? (
                        <motion.p
                          key={totalEntries}
                          initial={{ scale: 1.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          style={{ color: 'var(--c-accent)', fontFamily: 'Orbitron, sans-serif', fontSize: '26px', fontWeight: 700, lineHeight: 1 }}
                        >
                          {totalEntries}
                        </motion.p>
                      ) : (
                        <p style={{ color: 'var(--c-muted)', fontFamily: 'Orbitron, sans-serif', fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>—</p>
                      )}
                      <p style={{ color: 'var(--c-muted)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', marginTop: 4 }}>MEMORIES</p>
                    </div>
                    {/* Category count */}
                    <div className="flex-1 flex flex-col items-center py-4">
                      {memory ? (
                        <motion.p
                          key={categories.length}
                          initial={{ scale: 1.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          style={{ color: 'var(--c-accent2)', fontFamily: 'Orbitron, sans-serif', fontSize: '26px', fontWeight: 700, lineHeight: 1 }}
                        >
                          {categories.length}
                        </motion.p>
                      ) : (
                        <p style={{ color: 'var(--c-muted)', fontFamily: 'Orbitron, sans-serif', fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>—</p>
                      )}
                      <p style={{ color: 'var(--c-muted)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', marginTop: 4 }}>CATEGORIES</p>
                    </div>
                  </div>

                  {/* Category breakdown bar */}
                  {memory && totalEntries > 0 && (
                    <div style={{ height: 4, display: 'flex', background: 'var(--c-surface)' }}>
                      {categories.map(cat => (
                        <div key={cat} style={{
                          flex: memory[cat].length,
                          background: `rgb(${getColor(cat)})`,
                          opacity: 0.7,
                          transition: 'flex 0.4s ease',
                        }} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Category chips */}
                {memory && categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <div key={cat} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{
                        background: `rgba(${getColor(cat)}, 0.08)`,
                        border: `1px solid rgba(${getColor(cat)}, 0.3)`,
                      }}>
                        <span style={{ fontSize: 12 }}>{getIcon(cat)}</span>
                        <span style={{ color: `rgb(${getColor(cat)})`, fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>
                          {cat.toUpperCase()}
                        </span>
                        <span style={{
                          background: `rgba(${getColor(cat)}, 0.2)`,
                          color: `rgb(${getColor(cat)})`,
                          fontSize: '9px', fontFamily: 'Orbitron, sans-serif',
                          fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                        }}>
                          {memory[cat].length}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Entries list, grouped by real category */}
                {memory ? (
                  <>
                    {categories.map(cat => (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-2">
                          <span style={{ fontSize: 13 }}>{getIcon(cat)}</span>
                          <span style={{ color: `rgb(${getColor(cat)})`, fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', fontWeight: 700 }}>
                            {cat.toUpperCase()}
                          </span>
                          <span style={{ color: `rgb(${getColor(cat)})`, background: `rgba(${getColor(cat)}, 0.12)`, border: `1px solid rgba(${getColor(cat)}, 0.25)`, fontSize: '9px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
                            {memory[cat].length}
                          </span>
                          <div style={{ flex: 1, height: 1, background: `rgba(${getColor(cat)}, 0.2)` }} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {memory[cat].map(e => (
                            <motion.div
                              key={e.id}
                              layout
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -8 }}
                              className="flex items-start gap-2 rounded-lg px-3 py-2"
                              style={{
                                background: 'var(--c-card)',
                                border: '1px solid var(--c-border)',
                                borderLeft: `2px solid rgba(${getColor(cat)}, 0.5)`,
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                {e.key && (
                                  <span style={{ color: `rgb(${getColor(cat)})`, fontSize: '10px', fontWeight: 600, marginRight: 6 }}>
                                    {e.key}:
                                  </span>
                                )}
                                <span style={{ color: 'var(--c-dim)', fontSize: '12px' }}>{e.value}</span>
                                {e.timestamp && (
                                  <p style={{ color: 'var(--c-muted)', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>
                                    {new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                )}
                              </div>
                              <button className="btn-icon w-5 h-5 flex-shrink-0 mt-0.5" onClick={() => deleteMemoryEntry(cat, e.id)}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {totalEntries === 0 && (
                      <div className="flex flex-col items-center py-10 gap-3">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--c-muted)' }}>
                          <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                        </svg>
                        <p style={{ color: 'var(--c-muted)', fontSize: '12px', textAlign: 'center', maxWidth: 200 }}>
                          No memories yet.<br/>Tell Zeus to remember something — like your name, preferences, or project paths.
                        </p>
                      </div>
                    )}

                    {totalEntries > 0 && (
                      <div className="rounded-xl p-3" style={{ background: 'rgba(255,51,102,0.04)', border: '1px solid rgba(255,51,102,0.2)' }}>
                        <button className="w-full py-2 rounded-lg text-xs transition-all"
                          style={{ background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.3)', color: 'var(--c-red)', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}
                          onClick={clearAllMemory}
                        >CLEAR ALL {totalEntries} MEMORIES</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-accent)', animation: 'blink 1s 0s infinite' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-accent)', animation: 'blink 1s 0.18s infinite' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-accent)', animation: 'blink 1s 0.36s infinite' }} />
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ APPEARANCE ════════════════════════════════════════════════════ */}
          {tab === 'appearance' && (
            <AppearanceTab local={local} setLocal={setLocal} setSettings={setSettings} />
          )}

          {/* ═══ ABOUT ═════════════════════════════════════════════════════════ */}
          {tab === 'about' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center py-6 gap-3">
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: 'linear-gradient(135deg, #0d1f3c, #0a1628)',
                  border: '1px solid var(--c-border-hi)',
                  boxShadow: '0 0 30px rgba(0,212,255,0.2), inset 0 0 20px rgba(0,212,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="bolt-icon">
                    <path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z" fill="url(#about-bolt)" />
                    <defs>
                      <linearGradient id="about-bolt" x1="4" y1="2" x2="20" y2="22">
                        <stop offset="0%" stopColor="#00d4ff"/><stop offset="100%" stopColor="#0066cc"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-orbitron font-bold tracking-widest glow-text" style={{ color: 'var(--c-accent)', fontSize: '20px' }}>ZEUS AI</p>
                  <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: 4 }}>Advanced Computer Assistant · v1.0.0</p>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <p style={{ ...labelStyle, marginBottom: 12 }}>CAPABILITIES</p>
                {[
                  ['🖥','PC Control','Open apps, manage files, run commands'],
                  ['🧠','Multi-AI','Anthropic, OpenAI, Gemini, Ollama'],
                  ['📸','Vision','Screenshot capture and screen awareness'],
                  ['🎤','Voice','Speech-to-text input'],
                  ['⚡','Tools','30+ built-in automation tools'],
                  ['💾','Memory','Persistent memory across conversations'],
                  ['✈️','Telegram','Message Zeus from anywhere'],
                  ['</>','Code Agent','Autonomous coding in any directory'],
                ].map(([icon,title,desc]) => (
                  <div key={title} className="flex items-start gap-3 mb-3">
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                    <div>
                      <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 500 }}>{title}</p>
                      <p style={{ color: 'var(--c-muted)', fontSize: '10px' }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                <p style={{ ...labelStyle, marginBottom: 10 }}>KEYBOARD SHORTCUTS</p>
                {[['Enter','Send message'],['Shift+Enter','New line'],['Esc','Close settings']].map(([key,desc]) => (
                  <div key={key} className="flex items-center justify-between mb-2">
                    <span style={{ color: 'var(--c-dim)', fontSize: '12px' }}>{desc}</span>
                    <kbd style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 4, padding: '2px 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--c-accent)' }}>{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Save footer */}
      {needsSave && (
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--c-border)', background: 'rgba(0,0,0,0.2)' }}>
          <motion.button
            className="w-full btn-primary rounded-xl py-2.5 font-orbitron tracking-wider flex items-center justify-center gap-2"
            style={{ fontSize: '11px', letterSpacing: '0.12em' }}
            onClick={save}
            whileTap={{ scale: 0.97 }}
          >
            {saved ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                SAVED
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                SAVE SETTINGS
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}
