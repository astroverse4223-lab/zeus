import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore.js';

const labelStyle = {
  color: 'var(--c-muted)', fontSize: '10px',
  fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em',
};

const MODE_COLORS = { agent: 'var(--c-accent)', chat: 'var(--c-green, #74d7a0)', both: '#a8dab5' };

export default function PluginsPanel() {
  const assistantName = useStore(s => s.settings?.assistantName || 'Zeus');
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);
  const [list, setList] = useState([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!window.zeus?.pluginList) return;
    setList(await window.zeus.pluginList());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // The plugins IPC handlers mutate `settings.plugins.enabled` directly in the main
  // process (and persist it to disk) without going through the renderer's normal
  // saveSettings flow. If we don't mirror that back into the zustand store here, the
  // store's `settings` object goes stale — and the next time ANYTHING else in the app
  // calls saveSettings (changing a theme, a model, any toggle), it round-trips that
  // stale snapshot through the backend's deepMerge, which overwrites `enabled` back to
  // the old value. That's why plugins kept reverting after a restart.
  const syncEnabled = (enabled) => {
    if (!Array.isArray(enabled)) return;
    setSettings({ ...settings, plugins: { ...(settings.plugins || {}), enabled } });
  };

  const install = useCallback(async () => {
    const u = url.trim();
    if (!u || busy) return;
    setBusy(true); setError('');
    const res = await window.zeus.pluginInstall(u);
    setBusy(false);
    if (res?.error) { setError(String(res.error)); return; }
    setUrl('');
    syncEnabled(res?.enabled);
    refresh();
  }, [url, busy, refresh, settings]);

  const toggle = useCallback(async (slug, on) => {
    const res = await window.zeus.pluginToggle(slug, on);
    syncEnabled(res?.enabled);
    refresh();
  }, [refresh, settings]);

  const remove = useCallback(async (slug) => {
    const res = await window.zeus.pluginRemove(slug);
    syncEnabled(res?.enabled);
    refresh();
  }, [refresh, settings]);

  const inputStyle = {
    flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: '11px',
    background: 'var(--c-bg, #0b0f17)', border: '1px solid var(--c-border)',
    color: 'var(--c-text)', fontFamily: 'JetBrains Mono, monospace', outline: 'none',
  };
  const btnStyle = {
    padding: '7px 12px', borderRadius: 6, fontSize: '11px', cursor: 'pointer',
    background: 'var(--c-accent)', border: '1px solid var(--c-accent)', color: '#021018',
    fontWeight: 600, opacity: busy ? 0.6 : 1,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>PLUGINS</label>
        <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: 4 }}>
          Install skill packs from GitHub — they steer {assistantName} in agent &amp; chat mode.
        </div>
      </div>

      {/* Install field */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={inputStyle}
          placeholder="github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') install(); }}
        />
        <button style={btnStyle} onClick={install} disabled={busy}>
          {busy ? 'Installing…' : 'Install'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: '11px', color: '#ff6b6b', wordBreak: 'break-word' }}>⚠ {error}</div>
      )}

      {/* Installed list */}
      {list.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--c-muted)', padding: '8px 0' }}>
          No plugins installed yet. Paste a GitHub repo URL above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((p) => (
            <div
              key={p.slug}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                borderRadius: 8, background: 'var(--c-card)', border: '1px solid var(--c-border)',
              }}
            >
              {/* Enable toggle */}
              <button
                onClick={() => toggle(p.slug, !p.enabled)}
                title={p.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                style={{
                  marginTop: 2, width: 30, height: 17, flexShrink: 0, borderRadius: 9, cursor: 'pointer',
                  border: '1px solid var(--c-border)', position: 'relative',
                  background: p.enabled ? 'var(--c-accent)' : 'var(--c-bg, #1a1f2a)', transition: 'background 0.15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 1, left: p.enabled ? 14 : 1, width: 13, height: 13,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                }} />
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)' }}>{p.name}</span>
                  <span style={{
                    fontSize: 8, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em',
                    color: MODE_COLORS[p.mode] || 'var(--c-muted)', border: `1px solid ${MODE_COLORS[p.mode] || 'var(--c-border)'}`,
                    borderRadius: 4, padding: '1px 4px', textTransform: 'uppercase',
                  }}>{p.mode}</span>
                </div>
                {p.description && (
                  <div style={{ fontSize: 10, color: 'var(--c-muted)', marginTop: 2 }}>{p.description}</div>
                )}
                <div style={{ fontSize: 9, color: 'var(--c-dim)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                  {p.repo}{p.version ? ` · v${p.version}` : ''} · {(p.skills || []).length} skill{(p.skills || []).length === 1 ? '' : 's'}
                </div>
              </div>

              <button
                onClick={() => remove(p.slug)}
                title="Remove"
                style={{ background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
