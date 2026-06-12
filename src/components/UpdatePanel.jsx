import React, { useEffect, useState, useCallback } from 'react';

const labelStyle = {
  color: 'var(--c-muted)', fontSize: '10px',
  fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em',
};
const btnStyle = {
  padding: '6px 12px', borderRadius: 6, fontSize: '11px', cursor: 'pointer',
  background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)',
};

export default function UpdatePanel() {
  const [version, setVersion] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null); // checkForUpdate result
  const [progress, setProgress] = useState(null); // { received, total }
  const [file, setFile] = useState(null);

  useEffect(() => {
    window.zeus?.appVersion?.().then(setVersion);
    const off = window.zeus?.onUpdateProgress?.((p) => setProgress(p));
    return () => off && off();
  }, []);

  const check = useCallback(async () => {
    setChecking(true); setResult(null); setFile(null);
    setResult(await window.zeus.updateCheck());
    setChecking(false);
  }, []);

  const download = useCallback(async () => {
    if (!result?.downloadUrl) return;
    setProgress({ received: 0, total: 0 });
    const r = await window.zeus.updateDownload(result.downloadUrl);
    setProgress(null);
    if (r?.file) setFile(r.file);
    else if (r?.error) setResult((cur) => ({ ...cur, error: 'DOWNLOAD', message: r.error }));
  }, [result]);

  const pct = progress && progress.total ? Math.round((progress.received / progress.total) * 100) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>UPDATES</label>
        <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: 4 }}>
          Current version: v{version || '…'}
        </div>
      </div>

      <div>
        <button style={btnStyle} onClick={check} disabled={checking}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
      </div>

      {result && !result.error && !result.newer && (
        <div style={{ fontSize: '11px', color: 'var(--c-muted)' }}>You're on the latest version.</div>
      )}

      {result && result.error && (
        <div style={{ fontSize: '11px', color: '#ff6b6b' }}>⚠ {result.message}</div>
      )}

      {result && result.newer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '12px', color: 'var(--c-text)' }}>
            v{result.latest} available
          </div>
          {result.notes && (
            <div style={{
              fontSize: '10px', color: 'var(--c-muted)', maxHeight: 90, overflowY: 'auto',
              whiteSpace: 'pre-wrap', border: '1px solid var(--c-border)', borderRadius: 6, padding: 8,
            }}>{result.notes}</div>
          )}
          {result.noAsset ? (
            <div style={{ fontSize: '11px', color: '#ff6b6b' }}>Latest release has no downloadable build.</div>
          ) : !file ? (
            <button style={btnStyle} onClick={download} disabled={!!progress}>
              {progress ? `Downloading… ${pct != null ? pct + '%' : ''}` : 'Download'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: '11px', color: 'var(--c-text)' }}>Downloaded. Unzip it and replace your Zeus folder.</div>
              <button style={btnStyle} onClick={() => window.zeus.revealFile(file)}>Reveal in folder</button>
            </div>
          )}
          {progress && progress.total > 0 && (
            <div style={{ height: 4, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--c-accent)' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
