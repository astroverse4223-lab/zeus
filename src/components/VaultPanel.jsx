import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const STRENGTH_COLORS = ['#ff3366', '#ff6b35', '#ffcc00', '#00d4ff', '#00ff88'];

// ─── Small shared bits ──────────────────────────────────────────────────────────

function IconBtn({ title, onClick, children, color = 'var(--c-muted)' }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="btn-icon w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md"
      style={{ color }}
    >
      {children}
    </button>
  );
}

function CopyIcon({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <IconBtn title={copied ? 'Copied!' : `Copy ${label}`} onClick={copy} color={copied ? 'var(--c-green)' : 'var(--c-muted)'}>
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </IconBtn>
  );
}

function StrengthMeter({ pw }) {
  const [strength, setStrength] = useState({ score: 0, label: 'Empty' });
  useEffect(() => {
    let alive = true;
    if (!pw) { setStrength({ score: 0, label: 'Empty' }); return; }
    window.zeus?.vaultPasswordStrength(pw).then(s => { if (alive && s) setStrength(s); });
    return () => { alive = false; };
  }, [pw]);
  const color = STRENGTH_COLORS[strength.score] || STRENGTH_COLORS[0];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: 4, flex: 1, borderRadius: 2,
            background: i <= strength.score && pw ? color : 'var(--c-border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 10, color, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em', flexShrink: 0, width: 78, textAlign: 'right' }}>
        {pw ? strength.label : ''}
      </span>
    </div>
  );
}

// ─── Password generator ─────────────────────────────────────────────────────────

function PasswordGenerator({ onUse }) {
  const [opts, setOpts] = useState({ length: 18, lower: true, upper: true, numbers: true, symbols: true, excludeAmbiguous: false });
  const [pw, setPw] = useState('');

  const generate = useCallback(async (o) => {
    const res = await window.zeus?.vaultGeneratePassword(o || opts);
    if (res?.ok) setPw(res.data);
  }, [opts]);

  useEffect(() => { generate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) => {
    const next = { ...opts, [key]: !opts[key] };
    setOpts(next);
    generate(next);
  };
  const setLength = (v) => {
    const next = { ...opts, length: v };
    setOpts(next);
    generate(next);
  };

  const CHIPS = [
    ['lower', 'a-z'], ['upper', 'A-Z'], ['numbers', '0-9'], ['symbols', '!@#'],
  ];

  return (
    <div className="flex flex-col gap-4 p-5" style={{ maxWidth: 420 }}>
      <div>
        <label style={{ color: 'var(--c-muted)', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
          GENERATED PASSWORD
        </label>
        <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border-hi)', boxShadow: '0 0 16px var(--c-glow)' }}>
          <span className="flex-1" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, color: 'var(--c-accent)', letterSpacing: '0.03em', wordBreak: 'break-all' }}>
            {pw || '···'}
          </span>
          <IconBtn title="Regenerate" onClick={() => generate()} color="var(--c-accent)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          </IconBtn>
          <CopyIcon value={pw} label="password" />
        </div>
        <div className="mt-2"><StrengthMeter pw={pw} /></div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label style={{ color: 'var(--c-muted)', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>LENGTH</label>
          <span style={{ color: 'var(--c-accent)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{opts.length}</span>
        </div>
        <input type="range" min={6} max={64} value={opts.length} onChange={e => setLength(parseInt(e.target.value))}
          className="w-full" style={{ accentColor: 'var(--c-accent)' }} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map(([key, label]) => (
          <button key={key} onClick={() => toggle(key)} style={{
            padding: '6px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', borderRadius: 8,
            background: opts[key] ? 'var(--c-glow)' : 'var(--c-card)',
            border: `1px solid ${opts[key] ? 'var(--c-accent)' : 'var(--c-border)'}`,
            color: opts[key] ? 'var(--c-accent)' : 'var(--c-muted)', cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 11, color: 'var(--c-muted)' }}>
        <input type="checkbox" checked={opts.excludeAmbiguous} onChange={() => toggle('excludeAmbiguous')} />
        Exclude ambiguous characters (I, l, 1, O, 0)
      </label>

      {onUse && (
        <button
          className="btn-primary rounded-xl py-2.5 text-sm font-orbitron tracking-widest"
          style={{ fontSize: 11, letterSpacing: '0.1em' }}
          onClick={() => onUse(pw)}
          disabled={!pw}
        >
          USE THIS PASSWORD
        </button>
      )}
    </div>
  );
}

// ─── Entry form (create / edit) ─────────────────────────────────────────────────

function EntryForm({ entry, onSave, onCancel, onDelete }) {
  const [label, setLabel] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showGen, setShowGen] = useState(false);

  useEffect(() => {
    setLabel(entry?.label || '');
    setUsername(entry?.username || '');
    setPassword(entry?.password || '');
    setUrl(entry?.url || '');
    setNotes(entry?.notes || '');
    setShowPw(false);
    setShowGen(false);
  }, [entry?.id]);

  const fieldStyle = { background: 'var(--c-card)', border: '1px solid var(--c-border)' };
  const labelStyle = { color: 'var(--c-muted)', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', display: 'block', marginBottom: 6 };
  const canSave = label.trim().length > 0;

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto" style={{ maxWidth: 480 }}>
      <div>
        <label style={labelStyle}>LABEL / SITE *</label>
        <input className="api-key-input w-full rounded-lg px-3 py-2 text-sm" style={fieldStyle}
          placeholder="e.g. GitHub, Gmail, Bank of America" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
      </div>

      <div>
        <label style={labelStyle}>USERNAME / EMAIL</label>
        <div className="flex items-center gap-1.5">
          <input className="api-key-input flex-1 rounded-lg px-3 py-2 text-sm" style={fieldStyle}
            placeholder="you@example.com" value={username} onChange={e => setUsername(e.target.value)} />
          <CopyIcon value={username} label="username" />
        </div>
      </div>

      <div>
        <label style={labelStyle}>PASSWORD</label>
        <div className="flex items-center gap-1.5">
          <input type={showPw ? 'text' : 'password'} className="api-key-input flex-1 rounded-lg px-3 py-2 text-sm"
            style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }}
            placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          <IconBtn title={showPw ? 'Hide' : 'Reveal'} onClick={() => setShowPw(v => !v)}>
            {showPw ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </IconBtn>
          <CopyIcon value={password} label="password" />
        </div>
        <div className="mt-2"><StrengthMeter pw={password} /></div>
        <button onClick={() => setShowGen(v => !v)} style={{
          marginTop: 8, fontSize: 10, color: 'var(--c-accent)', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em',
        }}>
          {showGen ? '▾ HIDE GENERATOR' : '⚡ GENERATE A PASSWORD'}
        </button>
        {showGen && (
          <div className="mt-2 rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
            <PasswordGenerator onUse={(p) => { setPassword(p); setShowPw(true); setShowGen(false); }} />
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle}>URL</label>
        <input className="api-key-input w-full rounded-lg px-3 py-2 text-sm" style={fieldStyle}
          placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} />
      </div>

      <div>
        <label style={labelStyle}>NOTES</label>
        <textarea rows={3} className="api-key-input w-full rounded-lg px-3 py-2 text-sm" style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'Inter, sans-serif' }}
          placeholder="Optional — security questions, recovery codes, etc." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="flex gap-2 mt-1">
        <button className="btn-ghost flex-1 rounded-xl py-2.5 text-sm" onClick={onCancel}>Cancel</button>
        <button
          className="btn-primary flex-1 rounded-xl py-2.5 text-sm font-orbitron tracking-widest"
          style={{ fontSize: 11, letterSpacing: '0.1em', opacity: canSave ? 1 : 0.4, cursor: canSave ? 'pointer' : 'default' }}
          disabled={!canSave}
          onClick={() => canSave && onSave({ id: entry?.id, label: label.trim(), username: username.trim(), password, url: url.trim(), notes })}
        >
          {entry?.id ? 'SAVE CHANGES' : 'ADD ENTRY'}
        </button>
        {entry?.id && (
          <IconBtn title="Delete entry" onClick={onDelete} color="var(--c-red)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </IconBtn>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────────

export default function VaultPanel({ onClose }) {
  const [mode, setMode] = useState('loading'); // loading | setup | locked | unlocked
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [rightView, setRightView] = useState('empty'); // empty | entry | generator
  const [search, setSearch] = useState('');

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [unlockPw, setUnlockPw] = useState('');

  const refreshList = useCallback(async () => {
    const res = await window.zeus?.vaultList();
    if (res?.ok) setEntries(res.data);
  }, []);

  useEffect(() => {
    (async () => {
      if (!window.zeus?.vaultExists) {
        setMode('error');
        setError('Vault bridge is unavailable — fully restart Zeus (not just reload) to pick up this update.');
        return;
      }
      try {
        const exists = await window.zeus.vaultExists();
        if (!exists) { setMode('setup'); return; }
        const unlocked = await window.zeus.vaultIsUnlocked();
        if (unlocked) { await refreshList(); setMode('unlocked'); }
        else setMode('locked');
      } catch (err) {
        setMode('error');
        setError(err?.message || 'Failed to load the vault.');
      }
    })();
  }, [refreshList]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const doSetup = async () => {
    setError('');
    if (pw1.length < 4) return setError('Master password must be at least 4 characters.');
    if (pw1 !== pw2) return setError('Passwords do not match.');
    setBusy(true);
    const res = await window.zeus?.vaultSetup(pw1);
    setBusy(false);
    if (!res?.ok) return setError(res?.error || 'Could not create vault.');
    setPw1(''); setPw2('');
    await refreshList();
    setMode('unlocked');
  };

  const doUnlock = async () => {
    setError('');
    setBusy(true);
    const res = await window.zeus?.vaultUnlock(unlockPw);
    setBusy(false);
    if (!res?.ok) return setError(res?.error || 'Incorrect password.');
    setUnlockPw('');
    await refreshList();
    setMode('unlocked');
  };

  const doLock = async () => {
    await window.zeus?.vaultLock();
    setEntries([]); setSelectedId(null); setRightView('empty');
    setMode('locked');
  };

  const doReset = async () => {
    if (!confirm('This permanently deletes ALL saved entries with no way to recover them. Continue?')) return;
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
    await window.zeus?.vaultReset();
    setEntries([]); setSelectedId(null); setRightView('empty');
    setMode('setup');
  };

  const saveEntry = async (data) => {
    const res = data.id
      ? await window.zeus?.vaultUpdate(data.id, data)
      : await window.zeus?.vaultAdd(data);
    if (res?.ok) {
      await refreshList();
      setSelectedId(res.data.id);
      setRightView('entry');
    }
  };

  const deleteEntry = async (id) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    const res = await window.zeus?.vaultRemove(id);
    if (res?.ok) {
      await refreshList();
      setSelectedId(null);
      setRightView('empty');
    }
  };

  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return e.label.toLowerCase().includes(q) || e.username.toLowerCase().includes(q);
  });
  const selected = entries.find(e => e.id === selectedId) || null;

  const LockIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-[60] flex flex-col"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ height: 40, borderBottom: '1px solid var(--c-border)', background: '#080c14' }}>
        <LockIcon />
        <span style={{ color: 'var(--c-accent)', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.12em' }}>
          PASSWORD VAULT
        </span>
        {mode === 'unlocked' && (
          <span style={{ color: 'var(--c-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
          </span>
        )}
        <div className="flex-1" />
        {mode === 'unlocked' && (
          <button className="btn-icon" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }} onClick={doLock}>
            🔒 LOCK
          </button>
        )}
        <button className="btn-icon w-6 h-6" onClick={onClose} title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {mode === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Loading…</span>
        </div>
      )}

      {/* Error — IPC bridge missing or a vault read failed */}
      {mode === 'error' && (
        <div className="flex-1 flex items-center justify-center px-8">
          <p style={{ color: 'var(--c-red)', fontSize: 12, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>⚠ {error}</p>
        </div>
      )}

      {/* Setup (first run) */}
      {mode === 'setup' && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-4 p-6 rounded-2xl"
            style={{ width: 380, background: 'var(--c-card)', border: '1px solid var(--c-border-hi)', boxShadow: '0 0 50px var(--c-glow)' }}
          >
            <div className="flex flex-col items-center gap-2 mb-1">
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--c-accent2), var(--c-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px var(--c-glow-hi)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#080c14" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <p className="font-orbitron font-bold tracking-widest" style={{ color: 'var(--c-accent)', fontSize: 13 }}>CREATE YOUR VAULT</p>
              <p style={{ color: 'var(--c-muted)', fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>
                Choose a master password. It encrypts everything stored here — there is no recovery if you forget it.
              </p>
            </div>
            <input type="password" className="api-key-input w-full rounded-lg px-3 py-2.5 text-sm" placeholder="Master password"
              value={pw1} onChange={e => setPw1(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSetup()} autoFocus />
            <input type="password" className="api-key-input w-full rounded-lg px-3 py-2.5 text-sm" placeholder="Confirm master password"
              value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSetup()} />
            {error && <p style={{ color: 'var(--c-red)', fontSize: 11 }}>{error}</p>}
            <button className="btn-primary rounded-xl py-2.5 text-sm font-orbitron tracking-widest" style={{ fontSize: 11, letterSpacing: '0.1em', opacity: busy ? 0.6 : 1 }} onClick={doSetup} disabled={busy}>
              {busy ? 'CREATING…' : 'CREATE VAULT'}
            </button>
          </motion.div>
        </div>
      )}

      {/* Locked */}
      {mode === 'locked' && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-4 p-6 rounded-2xl"
            style={{ width: 360, background: 'var(--c-card)', border: '1px solid var(--c-border-hi)', boxShadow: '0 0 50px var(--c-glow)' }}
          >
            <div className="flex flex-col items-center gap-2 mb-1">
              <LockIcon />
              <p className="font-orbitron font-bold tracking-widest" style={{ color: 'var(--c-accent)', fontSize: 13 }}>VAULT LOCKED</p>
            </div>
            <input type="password" className="api-key-input w-full rounded-lg px-3 py-2.5 text-sm" placeholder="Master password"
              value={unlockPw} onChange={e => setUnlockPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && doUnlock()} autoFocus />
            {error && <p style={{ color: 'var(--c-red)', fontSize: 11 }}>{error}</p>}
            <button className="btn-primary rounded-xl py-2.5 text-sm font-orbitron tracking-widest" style={{ fontSize: 11, letterSpacing: '0.1em', opacity: busy ? 0.6 : 1 }} onClick={doUnlock} disabled={busy}>
              {busy ? 'UNLOCKING…' : 'UNLOCK'}
            </button>
            <button onClick={doReset} style={{ background: 'none', border: 'none', color: 'var(--c-muted)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}>
              Forgot password? Reset vault (deletes everything)
            </button>
          </motion.div>
        </div>
      )}

      {/* Unlocked */}
      {mode === 'unlocked' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Entry list */}
          <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: 280, borderRight: '1px solid var(--c-border)', background: '#0a0e15' }}>
            <div className="p-2.5 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
              <div className="flex gap-1.5">
                <button className="flex-1 btn-icon rounded-lg py-2" style={{ fontSize: 10.5, color: 'var(--c-accent)', border: '1px solid var(--c-accent)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em' }}
                  onClick={() => { setSelectedId(null); setRightView('entry'); }}>
                  + ADD
                </button>
                <button className="flex-1 btn-icon rounded-lg py-2" style={{ fontSize: 10.5, color: 'var(--c-dim)', border: '1px solid var(--c-border)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em' }}
                  onClick={() => { setSelectedId(null); setRightView('generator'); }}>
                  ⚡ GENERATE
                </button>
              </div>
              <input className="api-key-input w-full rounded-lg px-3 py-1.5 text-sm" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
                placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p style={{ color: 'var(--c-muted)', fontSize: 11, textAlign: 'center', padding: '20px 8px' }}>
                  {entries.length === 0 ? 'No entries yet. Add your first one.' : 'No matches.'}
                </p>
              ) : filtered.map(e => (
                <div key={e.id} onClick={() => { setSelectedId(e.id); setRightView('entry'); }}
                  className="flex items-center gap-2.5 cursor-pointer rounded-lg"
                  style={{
                    padding: '8px 10px', marginBottom: 3,
                    background: e.id === selectedId ? 'rgba(0,212,255,0.10)' : 'transparent',
                    border: e.id === selectedId ? '1px solid var(--c-accent)' : '1px solid transparent',
                  }}
                  onMouseEnter={ev => { if (e.id !== selectedId) ev.currentTarget.style.background = 'var(--c-glow)'; }}
                  onMouseLeave={ev => { if (e.id !== selectedId) ev.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, var(--c-accent2), var(--c-accent))', color: '#080c14', fontWeight: 700, fontSize: 12,
                  }}>
                    {(e.label[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ color: 'var(--c-text)', fontSize: 12.5, fontWeight: 500 }}>{e.label}</p>
                    <p className="truncate" style={{ color: 'var(--c-muted)', fontSize: 10.5 }}>{e.username || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail pane */}
          <div className="flex-1 overflow-y-auto flex" style={{ justifyContent: rightView === 'empty' ? 'center' : 'flex-start', alignItems: rightView === 'empty' ? 'center' : 'stretch' }}>
            {rightView === 'empty' && (
              <p style={{ color: 'var(--c-muted)', fontSize: 12 }}>Select an entry, add a new one, or generate a password.</p>
            )}
            {rightView === 'generator' && (
              <div className="w-full flex justify-center pt-6">
                <PasswordGenerator />
              </div>
            )}
            {rightView === 'entry' && (
              <div className="w-full flex justify-center pt-2">
                <EntryForm
                  entry={selected}
                  onSave={saveEntry}
                  onCancel={() => { setRightView(selected ? 'entry' : 'empty'); if (!selected) setSelectedId(null); }}
                  onDelete={() => selected && deleteEntry(selected.id)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
