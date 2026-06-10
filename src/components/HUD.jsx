import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore.js';

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

export default function HUD() {
  const { settings, settingsOpen, setSettingsOpen, sidebarOpen, setSidebarOpen, streaming } = useStore();
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

  return (
    <div
      className="titlebar-drag flex items-center h-12 px-3 gap-3 flex-shrink-0"
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

      {/* Logo */}
      <div className="flex items-center gap-2 titlebar-nodrag select-none">
        <BoltIcon />
        <span className="font-orbitron font-bold text-base tracking-widest glow-text" style={{ color: 'var(--c-accent)' }}>
          ZEUS
        </span>
      </div>

      {/* Provider badge */}
      <div className="titlebar-nodrag">
        <span className={`provider-badge provider-${provider}`}>{providerLabel}</span>
      </div>

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

      {/* System Stats */}
      <div className="flex items-center gap-4 titlebar-nodrag">
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
