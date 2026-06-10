import React, { useState, useEffect, useRef } from 'react';

// ─── Model catalog ─────────────────────────────────────────────────────────────
const CATALOG = [
  { id: 'llama3.2:1b',     name: 'Llama 3.2 1B',       gb: 1.3,  ramMin: 4,  tags: ['Fast','Light'],        desc: 'Fastest local model — minimal RAM, instant replies' },
  { id: 'llama3.2',        name: 'Llama 3.2 3B',       gb: 2.0,  ramMin: 4,  tags: ['Tools','Balanced'],    desc: "Meta's compact 3B with full tool-calling support" },
  { id: 'llama3.1:8b',     name: 'Llama 3.1 8B',       gb: 4.7,  ramMin: 8,  tags: ['Tools','Popular'],     desc: 'Best all-rounder — recommended starting point' },
  { id: 'mistral',         name: 'Mistral 7B',         gb: 4.1,  ramMin: 8,  tags: ['Tools','Fast'],        desc: 'Fast European model — excellent for coding & tools' },
  { id: 'mistral-nemo',    name: 'Mistral Nemo 12B',   gb: 7.1,  ramMin: 12, tags: ['Tools','Smart'],       desc: '12B with strong tool calling — great Zeus model' },
  { id: 'qwen2.5:7b',      name: 'Qwen 2.5 7B',        gb: 4.4,  ramMin: 8,  tags: ['Tools','Code'],        desc: "Alibaba's strong coder with multilingual support" },
  { id: 'qwen2.5:14b',     name: 'Qwen 2.5 14B',       gb: 8.9,  ramMin: 16, tags: ['Smart','Code'],        desc: 'Better reasoning than 7B — handles complex tasks' },
  { id: 'phi4',            name: 'Phi-4 14B',          gb: 9.1,  ramMin: 16, tags: ['Smart','Microsoft'],   desc: "Microsoft's efficient model that punches above weight" },
  { id: 'gemma2:9b',       name: 'Gemma 2 9B',         gb: 5.5,  ramMin: 8,  tags: ['Google','Smart'],      desc: "Google's Gemma 2 — excellent instruction following" },
  { id: 'deepseek-r1:7b',  name: 'DeepSeek R1 7B',     gb: 4.7,  ramMin: 8,  tags: ['Reasoning','Math'],    desc: 'Reasoning model — great for math, logic & analysis' },
  { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B',    gb: 9.0,  ramMin: 16, tags: ['Reasoning','Smart'],   desc: 'Stronger reasoning — use when R1 7B needs more depth' },
  { id: 'codellama:7b',    name: 'Code Llama 7B',      gb: 3.8,  ramMin: 8,  tags: ['Code','Meta'],         desc: "Meta's dedicated code generation model" },
  { id: 'llama3.1:70b',    name: 'Llama 3.1 70B',      gb: 39,   ramMin: 48, tags: ['Powerful','Large'],    desc: 'Near GPT-4 quality — needs a very powerful machine' },
];

const TAG_COLOR = {
  Fast: '#00ff88', Light: '#00ff88', Balanced: '#00d4ff', Tools: '#a855f7',
  Popular: '#ff9500', Smart: '#00d4ff', Code: '#ff6a00', Math: '#e879f9',
  Reasoning: '#e879f9', Google: '#4285f4', Microsoft: '#00a4ef',
  Large: '#ff3366', Powerful: '#ff3366', Meta: '#0082fb',
};

function fmtBytes(bytes) {
  if (!bytes) return '';
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
}

function ProgressBar({ completed, total, status, error }) {
  if (status === 'error') {
    return (
      <div style={{ marginTop: 8, color: 'var(--c-red)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
        Error: {error || 'Download failed'}
      </div>
    );
  }
  const pct = total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0;
  const isActive = total > 0 && status === 'downloading';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>
          {status?.toUpperCase() || 'STARTING'}
        </span>
        {isActive && (
          <span style={{ color: 'var(--c-accent)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
            {pct}%
          </span>
        )}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--c-border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: isActive ? 'var(--c-accent)' : 'var(--c-purple)',
          width: isActive ? `${pct}%` : '100%',
          transition: isActive ? 'width 0.3s' : 'none',
          animation: !isActive ? 'shimmer 1.5s ease-in-out infinite' : 'none',
        }} />
      </div>
    </div>
  );
}

function StatusBanner({ status, onRefresh }) {
  if (!status) return null;

  if (status.running) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
        <div className="status-dot online" style={{ flexShrink: 0 }} />
        <div className="flex-1">
          <p style={{ color: 'var(--c-green)', fontSize: '12px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
            OLLAMA RUNNING
          </p>
          {status.version && (
            <p style={{ color: 'var(--c-muted)', fontSize: '10px', marginTop: 2 }}>v{status.version}</p>
          )}
        </div>
        <button className="btn-icon px-3 py-1.5 rounded-lg" style={{ fontSize: '10px', fontFamily: 'Orbitron, sans-serif', border: '1px solid var(--c-border)' }} onClick={onRefresh}>
          REFRESH
        </button>
      </div>
    );
  }

  if (status.installed) {
    return (
      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,153,0,0.05)', border: '1px solid rgba(255,153,0,0.25)' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="status-dot" style={{ background: '#ff9500', flexShrink: 0 }} />
          <p style={{ color: '#ff9500', fontSize: '12px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
            OLLAMA INSTALLED — NOT RUNNING
          </p>
        </div>
        <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginBottom: 10 }}>
          Open a terminal and run <code style={{ color: 'var(--c-accent)', background: 'rgba(0,212,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>ollama serve</code> to start it, then click Refresh.
        </p>
        <button className="btn-icon px-3 py-1.5 rounded-lg" style={{ fontSize: '10px', fontFamily: 'Orbitron, sans-serif', border: '1px solid var(--c-border)' }} onClick={onRefresh}>
          REFRESH
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl px-4 py-4" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.2)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: '20px' }}>🦙</span>
        <p style={{ color: 'var(--c-accent)', fontSize: '13px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
          INSTALL OLLAMA FIRST
        </p>
      </div>
      <p style={{ color: 'var(--c-muted)', fontSize: '11px', lineHeight: 1.6, marginBottom: 12 }}>
        Ollama lets you run AI models locally on your PC — no API key, no internet, fully private.
        It takes about 2 minutes to set up.
      </p>
      <div className="flex gap-2">
        <button
          className="btn-primary rounded-lg px-4 py-2 flex-1"
          style={{ fontSize: '11px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}
          onClick={() => window.zeus?.openExternal('https://ollama.com/download/windows')}
        >
          DOWNLOAD OLLAMA
        </button>
        <button className="btn-icon px-3 py-2 rounded-lg" style={{ fontSize: '10px', fontFamily: 'Orbitron, sans-serif', border: '1px solid var(--c-border)' }} onClick={onRefresh}>
          CHECK AGAIN
        </button>
      </div>
    </div>
  );
}

export default function OllamaManager({ settings, onModelSelect }) {
  const [status, setStatus] = useState(null);
  const [installed, setInstalled] = useState([]);
  const [ramGB, setRamGB] = useState(null);
  const [pulling, setPulling] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterCompat, setFilterCompat] = useState(false);
  const unsubRef = useRef(null);

  useEffect(() => {
    loadAll();
    window.zeus?.getStats().then(s => {
      if (s?.ramTotal) setRamGB(parseInt(s.ramTotal, 10));
    }).catch(() => {});

    unsubRef.current = window.zeus?.onOllamaProgress?.(handleProgress);
    return () => unsubRef.current?.();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [s, m] = await Promise.all([
      window.zeus?.ollamaStatus().catch(() => ({ running: false, installed: false })),
      window.zeus?.ollamaModels().catch(() => ({ models: [] })),
    ]);
    setStatus(s);
    setInstalled(m.models || []);
    setLoading(false);
  }

  function handleProgress(data) {
    const { name, status: pStatus, completed, total, error } = data;
    if (pStatus === 'done') {
      setPulling(p => { const n = { ...p }; delete n[name]; return n; });
      loadAll();
    } else if (pStatus === 'error') {
      setPulling(p => ({ ...p, [name]: { status: 'error', completed: 0, total: 0, error: error || 'Download failed' } }));
      setTimeout(() => setPulling(p => { const n = { ...p }; delete n[name]; return n; }), 4000);
    } else {
      setPulling(p => ({ ...p, [name]: { status: pStatus, completed: completed || 0, total: total || 0 } }));
    }
  }

  function pull(modelId) {
    setPulling(p => ({ ...p, [modelId]: { status: 'connecting', completed: 0, total: 0 } }));
    window.zeus?.ollamaPull(modelId);
  }

  function cancelPull(modelId) {
    window.zeus?.ollamaCancelPull(modelId);
    setPulling(p => { const n = { ...p }; delete n[modelId]; return n; });
  }

  async function deleteModel(name) {
    await window.zeus?.ollamaDelete(name);
    setConfirmDelete(null);
    loadAll();
  }

  // Ollama stores models as 'name:latest' but catalog IDs use 'name' (no tag).
  // Build the set with both forms so installed detection works either way.
  const installedIds = new Set([
    ...installed.map(m => m.name),
    ...installed.map(m => m.name.replace(/:latest$/, '')),
  ]);

  const catalog = filterCompat && ramGB
    ? CATALOG.filter(m => m.ramMin <= ramGB)
    : CATALOG;

  const cardStyle = { background: 'var(--c-card)', border: '1px solid var(--c-border)' };

  return (
    <div className="flex flex-col gap-5">
      <StatusBanner status={status} onRefresh={loadAll} />

      {/* RAM info */}
      {ramGB && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={cardStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2">
            <rect x="2" y="7" width="20" height="10" rx="2"/>
            <path d="M7 7V5M12 7V5M17 7V5M7 17v2M12 17v2M17 17v2"/>
          </svg>
          <p style={{ color: 'var(--c-muted)', fontSize: '11px' }}>
            Your PC has <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>{ramGB} GB RAM</span>
            {ramGB >= 16 ? ' — most models will run great' : ramGB >= 8 ? ' — good selection available' : ' — stick to small models (4 GB RAM min)'}
          </p>
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            <span style={{ color: 'var(--c-muted)', fontSize: '10px' }}>Show compatible only</span>
            <button
              className="relative rounded-full flex-shrink-0"
              style={{ width: 34, height: 18, background: filterCompat ? 'var(--c-accent)' : 'var(--c-border)', border: 'none', cursor: 'pointer' }}
              onClick={() => setFilterCompat(v => !v)}
            >
              <div style={{ position: 'absolute', width: 12, height: 12, top: 3, left: filterCompat ? 19 : 3, borderRadius: '50%', background: filterCompat ? '#080c14' : 'var(--c-muted)', transition: 'left 0.15s' }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Installed models ───────────────────────────────────────────────── */}
      {installed.length > 0 && (
        <div>
          <p style={{ color: 'var(--c-muted)', fontSize: '11px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', marginBottom: 10 }}>
            INSTALLED ({installed.length})
          </p>
          <div className="flex flex-col gap-2">
            {installed.map(m => {
              const activeModel = settings?.providers?.ollama?.model || '';
              const isActive = activeModel === m.name || activeModel === m.name.replace(/:latest$/, '') || m.name === activeModel + ':latest';
              return (
                <div key={m.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{
                  background: isActive ? 'rgba(0,212,255,0.06)' : 'var(--c-card)',
                  border: `1px solid ${isActive ? 'rgba(0,212,255,0.3)' : 'var(--c-border)'}`,
                }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>🦙</span>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: 'var(--c-text)', fontSize: '12px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{m.name}</p>
                    {m.size && <p style={{ color: 'var(--c-muted)', fontSize: '10px', marginTop: 1 }}>{fmtBytes(m.size)}</p>}
                  </div>
                  {isActive ? (
                    <span style={{ color: 'var(--c-accent)', fontSize: '9px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', padding: '2px 8px', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 4 }}>ACTIVE</span>
                  ) : (
                    <button
                      className="btn-icon px-3 py-1 rounded-lg"
                      style={{ fontSize: '10px', fontFamily: 'Orbitron, sans-serif', border: '1px solid var(--c-border)' }}
                      onClick={() => onModelSelect?.(m.name)}
                    >
                      USE
                    </button>
                  )}
                  {confirmDelete === m.name ? (
                    <div className="flex gap-1">
                      <button className="btn-icon px-2 py-1 rounded" style={{ fontSize: '10px', color: 'var(--c-red)', border: '1px solid rgba(255,51,102,0.3)' }} onClick={() => deleteModel(m.name)}>DELETE</button>
                      <button className="btn-icon px-2 py-1 rounded" style={{ fontSize: '10px' }} onClick={() => setConfirmDelete(null)}>✕</button>
                    </div>
                  ) : (
                    <button className="btn-icon w-7 h-7 rounded-lg" style={{ color: 'var(--c-muted)' }} onClick={() => setConfirmDelete(m.name)} title="Delete model">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6">
          <span style={{ color: 'var(--c-muted)', fontSize: '12px' }}>Checking Ollama...</span>
        </div>
      )}

      {/* ── Model catalog ──────────────────────────────────────────────────── */}
      {(status?.running || status?.installed) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p style={{ color: 'var(--c-muted)', fontSize: '11px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>
              AVAILABLE MODELS
            </p>
            <span style={{ color: 'var(--c-muted)', fontSize: '10px' }}>{catalog.length} models</span>
          </div>
          {!status?.running && (
            <div className="rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.2)' }}>
              <p style={{ color: '#ff9500', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>
                OLLAMA NOT RUNNING — downloads will start automatically
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {catalog.map(m => {
              const isInstalled = installedIds.has(m.id);
              const isPulling = !!pulling[m.id];
              const pullState = pulling[m.id];
              const compatible = !ramGB || m.ramMin <= ramGB;
              const configuredModel = settings?.providers?.ollama?.model || '';
              const isActive = configuredModel === m.id || configuredModel === m.id + ':latest' || configuredModel.replace(/:latest$/, '') === m.id;

              return (
                <div key={m.id} className="rounded-xl p-3" style={{
                  background: isInstalled ? (isActive ? 'rgba(0,212,255,0.05)' : 'rgba(0,255,136,0.03)') : 'var(--c-card)',
                  border: `1px solid ${isActive ? 'rgba(0,212,255,0.3)' : isInstalled ? 'rgba(0,255,136,0.2)' : compatible ? 'var(--c-border)' : 'rgba(255,255,255,0.06)'}`,
                  opacity: !compatible && !isInstalled ? 0.55 : 1,
                }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Name + size */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: 600 }}>{m.name}</span>
                        <span style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>~{m.gb} GB</span>
                        {!compatible && (
                          <span style={{ color: '#ff3366', fontSize: '9px', padding: '1px 6px', border: '1px solid rgba(255,51,102,0.3)', borderRadius: 3, fontFamily: 'Orbitron, sans-serif' }}>
                            NEEDS {m.ramMin}GB RAM
                          </span>
                        )}
                        {isInstalled && (
                          <span style={{ color: 'var(--c-green)', fontSize: '9px', padding: '1px 6px', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 3, fontFamily: 'Orbitron, sans-serif' }}>
                            {isActive ? 'ACTIVE' : 'INSTALLED'}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p style={{ color: 'var(--c-muted)', fontSize: '11px', marginTop: 3, lineHeight: 1.5 }}>{m.desc}</p>

                      {/* Tags */}
                      <div className="flex gap-1 flex-wrap mt-2">
                        {m.tags.map(t => (
                          <span key={t} style={{
                            fontSize: '9px', padding: '2px 6px', borderRadius: 3,
                            color: TAG_COLOR[t] || 'var(--c-muted)',
                            background: `${TAG_COLOR[t] || '#888'}18`,
                            border: `1px solid ${TAG_COLOR[t] || '#888'}30`,
                            fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em',
                          }}>{t.toUpperCase()}</span>
                        ))}
                        <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: 3, color: 'var(--c-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--c-border)', fontFamily: 'Orbitron, sans-serif' }}>
                          {m.ramMin}GB MIN
                        </span>
                      </div>

                      {/* Progress bar */}
                      {isPulling && <ProgressBar completed={pullState.completed} total={pullState.total} status={pullState.status} error={pullState.error} />}
                    </div>

                    {/* Action button */}
                    <div className="flex-shrink-0 flex flex-col gap-1.5" style={{ marginTop: 2 }}>
                      {isPulling ? (
                        <button
                          className="btn-icon px-3 py-1.5 rounded-lg"
                          style={{ fontSize: '10px', fontFamily: 'Orbitron, sans-serif', color: 'var(--c-red)', border: '1px solid rgba(255,51,102,0.3)' }}
                          onClick={() => cancelPull(m.id)}
                        >
                          CANCEL
                        </button>
                      ) : isInstalled ? (
                        !isActive && (
                          <button
                            className="btn-icon px-3 py-1.5 rounded-lg"
                            style={{ fontSize: '10px', fontFamily: 'Orbitron, sans-serif', border: '1px solid var(--c-border)' }}
                            onClick={() => onModelSelect?.(m.id)}
                          >
                            USE
                          </button>
                        )
                      ) : (
                        <button
                          className="btn-primary px-3 py-1.5 rounded-lg"
                          style={{ fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em', opacity: !compatible ? 0.6 : 1 }}
                          onClick={() => pull(m.id)}
                        >
                          DOWNLOAD
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ollama not installed at all */}
      {status && !status.running && !status.installed && !loading && (
        <div className="rounded-xl p-4 text-center" style={cardStyle}>
          <p style={{ color: 'var(--c-muted)', fontSize: '12px' }}>
            Install Ollama above to download and run local models
          </p>
        </div>
      )}
    </div>
  );
}
