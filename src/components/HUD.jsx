import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore.js';
import { stopSpeaking } from '../lib/speech.js';
import { playSfx } from '../lib/sfx.js';

const BoltIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="bolt-icon">
    <path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z"
      fill="url(#bolt-grad)" stroke="rgba(0,212,255,0.4)" strokeWidth="0.5" />
    <defs>
      <linearGradient id="bolt-grad" x1="4" y1="2" x2="20" y2="22">
        <stop offset="0%"  stopColor="#00d4ff" />
        <stop offset="100%" stopColor="#0066cc" />
      </linearGradient>
    </defs>
  </svg>
);

const StatBar = ({ value, color = 'var(--c-accent)' }) => (
  <div className="stat-bar w-16">
    <div className="stat-bar-fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
  </div>
);

const PROVIDER_COLORS = { anthropic: '#e58c69', openai: '#74d7a0', gemini: '#8ab4f8', ollama: '#a8dab5' };
const PROVIDER_LABELS = { anthropic: 'CLAUDE', openai: 'GPT', gemini: 'GEMINI', ollama: 'OLLAMA' };

export const FAST_MODELS = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai:    'gpt-4o-mini',
  gemini:    'gemini-2.0-flash',
  ollama:    'llama3.2',
};

export const FAST_MODEL_LABELS = {
  anthropic: 'Haiku 4',
  openai:    'GPT-4o Mini',
  gemini:    'Gemini Flash',
  ollama:    'Llama 3.2 3B',
};

// Clicks on the logo within this window count toward the easter egg; a pause resets the streak.
const LOGO_CLICK_WINDOW_MS = 1500;
const LOGO_CLICKS_TO_UNLOCK = 7;

export default function HUD() {
  const { settings, setSettings, settingsOpen, setSettingsOpen, sidebarOpen, setSidebarOpen, streaming, fastMode, setFastMode, wakeWordEnabled, setWakeWordEnabled, speaking, setSpeaking, setSnakeOpen } = useStore();
  const logoClicksRef = useRef([]);
  const assistantName = settings?.assistantName || 'Zeus';

  // Hidden easter egg — click the ZEUS logo 7 times quickly to launch a theme-aware
  // game of Snake. Pure fun, no functional purpose.
  const handleLogoClick = () => {
    const now = Date.now();
    logoClicksRef.current = [...logoClicksRef.current.filter(t => now - t < LOGO_CLICK_WINDOW_MS), now];
    if (logoClicksRef.current.length >= LOGO_CLICKS_TO_UNLOCK) {
      logoClicksRef.current = [];
      setSnakeOpen(true);
      playSfx('tool');
    }
  };

  const autoSpeak = !!settings?.voice?.autoSpeak;
  const handleVoiceClick = () => {
    // While Zeus is talking, a click stops him immediately.
    if (speaking) { stopSpeaking(); setSpeaking(false, null); return; }
    // Otherwise toggle the persistent auto-speak setting.
    if (!settings) return;
    const updated = { ...settings, voice: { ...(settings.voice || {}), autoSpeak: !autoSpeak } };
    setSettings(updated);
    window.zeus?.saveSettings(updated);
  };
  const [stats, setStats] = useState({ cpu: 0, ram: 0, ramUsed: '0', ramTotal: '0', battery: null });
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const fetchStats = () => window.zeus?.getStats().then(setStats).catch(() => {});
    fetchStats();
    const interval = setInterval(fetchStats, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const provider = settings?.activeProvider || 'anthropic';
  const providerColor = PROVIDER_COLORS[provider];
  const providerLabel = PROVIDER_LABELS[provider];

  const cpuColor = stats.cpu > 80 ? 'var(--c-red)' : stats.cpu > 60 ? 'var(--c-yellow)' : 'var(--c-accent)';
  const ramColor = stats.ram > 80 ? 'var(--c-red)' : stats.ram > 60 ? 'var(--c-yellow)' : 'var(--c-accent)';
  const compact = !!settings?.ui?.hudCompact;

  return (
    <div
      className={`titlebar-drag flex items-center ${compact ? 'h-8 px-2 gap-2' : 'h-12 px-3 gap-3'} flex-shrink-0`}
      style={{
        background: 'linear-gradient(180deg, #0a0f1e 0%, #080c14 100%)',
        borderBottom: '1px solid var(--c-border)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* Sidebar toggle */}
      <button
        className="btn-icon titlebar-nodrag w-7 h-7"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>

      {/* Logo — click it a bunch of times fast for a surprise */}
      <div className="flex items-center gap-2 titlebar-nodrag select-none cursor-pointer" onClick={handleLogoClick}>
        <BoltIcon />
        <span className="font-orbitron font-bold text-base tracking-widest glow-text" style={{ color: 'var(--c-accent)' }}>
          {(settings?.assistantName || 'ZEUS').toUpperCase()}
        </span>
      </div>

      {/* Provider badge */}
      <div className="titlebar-nodrag">
        <span className={`provider-badge provider-${provider}`}>{providerLabel}</span>
      </div>

      {/* Wake word indicator */}
      <button
        className="titlebar-nodrag flex items-center gap-1 rounded-lg px-2 py-1 transition-all"
        onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
        title={wakeWordEnabled ? `Hey ${assistantName} listening — click to disable` : `Enable "Hey ${assistantName}" wake word`}
        style={{
          border: `1px solid ${wakeWordEnabled ? 'rgba(0,255,136,0.4)' : 'var(--c-border)'}`,
          background: wakeWordEnabled ? 'rgba(0,255,136,0.08)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: wakeWordEnabled ? '#00ff88' : 'var(--c-muted)',
          boxShadow: wakeWordEnabled ? '0 0 6px rgba(0,255,136,0.8)' : 'none',
          animation: wakeWordEnabled ? 'blink 1.8s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em',
          color: wakeWordEnabled ? '#00ff88' : 'var(--c-muted)',
        }}>MIC</span>
      </button>

      {/* Voice output (Zeus speaks) */}
      <button
        className="titlebar-nodrag flex items-center gap-1 rounded-lg px-2 py-1 transition-all"
        onClick={handleVoiceClick}
        title={speaking ? `${assistantName} is speaking — click to stop`
          : autoSpeak ? `Voice ON — ${assistantName} reads replies aloud · click to mute`
          : `Voice OFF — click to have ${assistantName} read replies aloud`}
        style={{
          border: `1px solid ${speaking ? 'rgba(16,222,150,0.55)' : autoSpeak ? 'rgba(16,222,150,0.4)' : 'var(--c-border)'}`,
          background: speaking ? 'rgba(16,222,150,0.12)' : autoSpeak ? 'rgba(16,222,150,0.06)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        {speaking ? (
          <div className="flex items-end gap-0.5" style={{ height: 11 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="eq-bar" style={{ animationDelay: `${i * 0.12}s`, height: `${7 + (i % 2) * 4}px` }} />
            ))}
          </div>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={autoSpeak ? '#10de96' : 'var(--c-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {autoSpeak
              ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>
              : <><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></>}
          </svg>
        )}
        <span style={{
          fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em',
          color: (speaking || autoSpeak) ? '#10de96' : 'var(--c-muted)',
        }}>{speaking ? 'SPEAKING' : 'VOICE'}</span>
      </button>

      {/* Mini-HUD toggle */}
      <button
        className="titlebar-nodrag btn-icon w-7 h-7 rounded-lg"
        onClick={() => window.zeus?.toggleMiniHUD()}
        title="Toggle floating mini-HUD"
        style={{ border: '1px solid var(--c-border)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </button>

      {/* Fast Mode toggle */}
      <button
        className="titlebar-nodrag flex items-center gap-1 rounded-lg px-2 py-1 transition-all"
        onClick={() => setFastMode(!fastMode)}
        title={fastMode
          ? `Fast Mode ON — using ${FAST_MODEL_LABELS[provider] || 'fast model'} · Click to disable`
          : `Fast Mode — switch to ${FAST_MODEL_LABELS[provider] || 'fast model'} for quicker replies`}
        style={{
          border: `1px solid ${fastMode ? 'rgba(255,213,0,0.5)' : 'var(--c-border)'}`,
          background: fastMode ? 'rgba(255,213,0,0.1)' : 'transparent',
          boxShadow: fastMode ? '0 0 10px rgba(255,213,0,0.2)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          style={{
            filter: fastMode ? 'drop-shadow(0 0 4px rgba(255,213,0,0.8))' : 'none',
            transition: 'filter 0.2s',
          }}
        >
          <path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z"
            fill={fastMode ? '#ffd500' : 'var(--c-muted)'}
            stroke={fastMode ? 'rgba(255,213,0,0.4)' : 'none'}
            strokeWidth="0.5"
          />
        </svg>
        <span style={{
          fontSize: '9px',
          fontFamily: 'Orbitron, sans-serif',
          letterSpacing: '0.1em',
          color: fastMode ? '#ffd500' : 'var(--c-muted)',
          fontWeight: fastMode ? 700 : 400,
          transition: 'color 0.2s',
        }}>
          FAST
        </span>
      </button>

      {/* Streaming indicator */}
      {streaming && (
        <div className="flex items-center gap-1.5 titlebar-nodrag">
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1 h-3 rounded-full"
                style={{
                  background: 'var(--c-accent)',
                  animation: `blink 0.8s ${i * 0.2}s infinite`,
                  boxShadow: '0 0 4px var(--c-accent)',
                }}
              />
            ))}
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--c-accent)' }}>PROCESSING</span>
        </div>
      )}

      <div className="flex-1" />

      {/* System Stats — hidden in compact mode */}
      <div className="flex items-center gap-4 titlebar-nodrag">
        {!compact && <>
          {/* CPU */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono" style={{ color: 'var(--c-muted)', fontSize: '10px' }}>CPU</span>
            <StatBar value={stats.cpu} color={cpuColor} />
            <span className="text-xs font-mono w-8 text-right" style={{ color: cpuColor, fontSize: '10px' }}>
              {stats.cpu}%
            </span>
          </div>

          {/* RAM */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono" style={{ color: 'var(--c-muted)', fontSize: '10px' }}>RAM</span>
            <StatBar value={stats.ram} color={ramColor} />
            <span className="text-xs font-mono w-14 text-right" style={{ color: ramColor, fontSize: '10px' }}>
              {stats.ramUsed}/{stats.ramTotal}G
            </span>
          </div>

          {/* Battery */}
          {stats.battery && (
            <div className="flex items-center gap-1" title="Battery">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: stats.battery.charging ? 'var(--c-green)' : 'var(--c-dim)' }}>
                <rect x="2" y="7" width="18" height="10" rx="2" />
                <path d="M22 11v2" strokeLinecap="round" />
                <rect x="4" y="9" width={`${Math.round(stats.battery.level * 0.14)}`} height="6" rx="1" fill="currentColor" stroke="none" />
              </svg>
              <span style={{ color: 'var(--c-muted)', fontSize: '10px' }} className="font-mono">
                {stats.battery.level}%
              </span>
            </div>
          )}

          {/* Time */}
          <span className="font-mono text-xs" style={{ color: 'var(--c-dim)', fontSize: '11px', letterSpacing: '0.05em' }}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </>}

        {/* Settings */}
        <button
          className="btn-icon w-7 h-7 titlebar-nodrag"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title="Settings"
          style={{ color: settingsOpen ? 'var(--c-accent)' : undefined }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Window controls */}
      <div className="flex items-center gap-1 titlebar-nodrag ml-1">
        <button
          className="w-3 h-3 rounded-full transition-all hover:brightness-125"
          style={{ background: '#ffcc00', boxShadow: '0 0 4px rgba(255,204,0,0.5)' }}
          onClick={() => window.zeus?.minimize()}
          title="Minimize"
        />
        <button
          className="w-3 h-3 rounded-full transition-all hover:brightness-125"
          style={{ background: '#00ff88', boxShadow: '0 0 4px rgba(0,255,136,0.5)' }}
          onClick={() => window.zeus?.maximize()}
          title="Maximize"
        />
        <button
          className="w-3 h-3 rounded-full transition-all hover:brightness-125"
          style={{ background: '#ff3366', boxShadow: '0 0 4px rgba(255,51,102,0.5)' }}
          onClick={() => window.zeus?.close()}
          title="Close"
        />
      </div>
    </div>
  );
}
