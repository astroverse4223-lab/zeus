import React, { useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore.js';
import FloatingPanel from './FloatingPanel.jsx';

const LOCAL_SIZES = [['512x512','512²'],['768x768','768²'],['512x768','512×768'],['768x512','768×512'],['1024x1024','1024²']];
const HOSTED_SIZES = [['1024x1024','Square'],['1792x1024','Wide'],['1024x1792','Tall']];
const SAMPLERS = ['euler','euler_ancestral','dpmpp_2m','dpmpp_2m_sde','dpmpp_sde','ddim','lms','heun'];
const SCHEDULERS = ['normal','karras','exponential','sgm_uniform'];

const fieldStyle = {
  width: '100%', background: 'var(--c-card)', border: '1px solid var(--c-border)',
  borderRadius: 8, color: 'var(--c-text)', fontSize: 12, padding: '7px 9px',
};
const labelStyle = { color: 'var(--c-muted)', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', display: 'block', marginBottom: 5 };

export default function ImageGen({ onClose }) {
  const { settings, setSettings, setImageEditorSource, setImageEditorOpen, genPromptPrefill, setGenPromptPrefill } = useStore();

  const [backend, setBackend] = useState(settings?.imageGen?.backend || 'comfyui'); // 'comfyui' | 'hosted' | 'replicate'
  const [apiKey, setApiKey] = useState(settings?.imageGen?.openaiApiKey || settings?.providers?.openai?.apiKey || '');
  const [replicateApiKey, setReplicateApiKey] = useState(settings?.imageGen?.replicateApiKey || settings?.videoGen?.replicateApiKey || '');
  const [replicateModel, setReplicateModel] = useState(settings?.imageGen?.replicateModel || 'black-forest-labs/flux-schnell');
  const [showKey, setShowKey] = useState(false);

  const [status, setStatus] = useState({ checking: true });
  const [checkpoints, setCheckpoints] = useState([]);
  const [ckpt, setCkpt] = useState('');

  const [prompt, setPrompt] = useState(genPromptPrefill || '');
  const [negative, setNegative] = useState('');
  const [size, setSize] = useState('512x512');

  // Content Factory hands off a generated prompt via the store, then opens this
  // panel — consume it once on mount so it doesn't leak into the next open.
  useEffect(() => {
    if (genPromptPrefill) setGenPromptPrefill(null);
  }, []);
  const [steps, setSteps] = useState(25);
  const [cfg, setCfg] = useState(7);
  const [sampler, setSampler] = useState('euler');
  const [scheduler, setScheduler] = useState('normal');
  const [seed, setSeed] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [savedMsg, setSavedMsg] = useState('');

  const persist = useCallback((patch) => {
    const updated = { ...settings, imageGen: { ...(settings?.imageGen || {}), ...patch } };
    setSettings(updated);
    window.zeus?.saveSettings(updated);
  }, [settings, setSettings]);

  const selectBackend = useCallback((b) => {
    setBackend(b);
    setSize(b === 'comfyui' ? '512x512' : '1024x1024');
    persist({ backend: b });
  }, [persist]);

  const onApiKeyChange = useCallback((v) => {
    setApiKey(v);
    persist({ openaiApiKey: v });
  }, [persist]);

  const onReplicateApiKeyChange = useCallback((v) => {
    setReplicateApiKey(v);
    persist({ replicateApiKey: v });
  }, [persist]);

  const onReplicateModelChange = useCallback((v) => {
    setReplicateModel(v);
    persist({ replicateModel: v });
  }, [persist]);

  const checkStatus = useCallback(async () => {
    setStatus({ checking: true });
    const res = await window.zeus?.imagegenStatus();
    if (res?.ok) {
      setStatus({ checking: false, ok: true });
      setCheckpoints(res.checkpoints || []);
      setCkpt(c => c || res.checkpoints?.[0] || '');
    } else {
      setStatus({ checking: false, ok: false, error: res?.error || 'ComfyUI unreachable' });
    }
  }, []);

  useEffect(() => { if (backend === 'comfyui') checkStatus(); }, [backend, checkStatus]);

  const generate = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setError(''); setResultUrl(null);
    let res;
    if (backend === 'hosted') {
      res = await window.zeus?.imagegenGenerateHosted({ prompt, size, apiKey });
    } else if (backend === 'replicate') {
      res = await window.zeus?.imagegenGenerateReplicate({ prompt, size, model: replicateModel, apiKey: replicateApiKey });
    } else {
      const [width, height] = size.split('x').map(Number);
      res = await window.zeus?.imagegenGenerate({
        prompt, negative, ckpt, steps, cfg, width, height, sampler, scheduler,
        seed: seed ? Number(seed) : undefined,
      });
    }
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setResultUrl(res.dataUrl);
  }, [backend, prompt, negative, ckpt, steps, cfg, size, sampler, scheduler, seed, apiKey, replicateModel, replicateApiKey, busy]);

  const editResult = useCallback(() => {
    setImageEditorSource(resultUrl);
    setImageEditorOpen(true);
    onClose();
  }, [resultUrl, onClose]);

  const saveResult = useCallback(async () => {
    if (!resultUrl) return;
    const res = await window.zeus?.editorSaveImage(resultUrl, 'zeus-generated.png');
    if (res?.error) { alert('Save failed: ' + res.error); return; }
    if (res?.path) { setSavedMsg(`Saved → ${res.path}`); setTimeout(() => setSavedMsg(''), 4000); }
  }, [resultUrl]);

  const ready = backend === 'hosted' ? !!apiKey : backend === 'replicate' ? !!replicateApiKey && !!replicateModel : status.ok;

  return (
    <FloatingPanel
      id="image-gen" title="IMAGE GENERATOR" onClose={onClose}
      defaultWidth={1040} defaultHeight={680}
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2z" />
        </svg>
      }
      headerExtra={
        <>
          {backend === 'comfyui' ? (
            status.checking ? (
              <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>checking ComfyUI…</span>
            ) : status.ok ? (
              <span style={{ color: 'var(--c-green)', fontSize: 10 }} className="flex items-center gap-1.5">
                <span className="status-dot online" /> ComfyUI connected
              </span>
            ) : (
              <span style={{ color: 'var(--c-red)', fontSize: 10 }}>ComfyUI unreachable — start it, then retry</span>
            )
          ) : backend === 'replicate' ? (
            <span style={{ color: replicateApiKey ? 'var(--c-green)' : 'var(--c-muted)', fontSize: 10 }}>
              {replicateApiKey ? 'API key set' : 'Enter your Replicate API key below'}
            </span>
          ) : (
            <span style={{ color: apiKey ? 'var(--c-green)' : 'var(--c-muted)', fontSize: 10 }}>
              {apiKey ? 'API key set' : 'Enter your OpenAI API key below'}
            </span>
          )}
          {savedMsg && <span style={{ color: 'var(--c-green)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{savedMsg}</span>}
          <div className="flex-1" />
          {backend === 'comfyui' && !status.ok && !status.checking && (
            <button className="btn-icon" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--c-accent)' }} onClick={checkStatus}>
              RETRY
            </button>
          )}
        </>
      }
    >
      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Controls */}
        <div className="flex flex-col gap-3 p-4 overflow-y-auto" style={{ width: 300, borderRight: '1px solid var(--c-border)', flexShrink: 0 }}>

          <div>
            <label style={labelStyle}>BACKEND</label>
            <div className="flex gap-1.5">
              {[['comfyui','Local (ComfyUI)'],['hosted','OpenAI'],['replicate','Replicate']].map(([val, lbl]) => (
                <button key={val} onClick={() => selectBackend(val)} style={{
                  flex: 1, padding: '6px 6px', fontSize: 10.5, borderRadius: 6,
                  background: backend === val ? 'var(--c-glow)' : 'var(--c-card)',
                  border: `1px solid ${backend === val ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  color: backend === val ? 'var(--c-accent)' : 'var(--c-muted)', cursor: 'pointer',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {backend === 'hosted' && (
            <div>
              <label style={labelStyle}>OPENAI API KEY</label>
              <div className="flex items-center gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  style={fieldStyle}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={e => onApiKeyChange(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button className="btn-icon w-8 h-8 rounded-lg flex-shrink-0" style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }} onClick={() => setShowKey(v => !v)}>
                  {showKey ? '🙈' : '👁'}
                </button>
              </div>
              <p style={{ color: 'var(--c-muted)', fontSize: 10, marginTop: 5, lineHeight: 1.5 }}>
                Uses OpenAI's DALL·E 3. Get a key at platform.openai.com — billed per image, no local setup needed.
              </p>
            </div>
          )}

          {backend === 'replicate' && (
            <>
              <div>
                <label style={labelStyle}>REPLICATE API KEY</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    style={fieldStyle}
                    placeholder="r8_..."
                    value={replicateApiKey}
                    onChange={e => onReplicateApiKeyChange(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button className="btn-icon w-8 h-8 rounded-lg flex-shrink-0" style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }} onClick={() => setShowKey(v => !v)}>
                    {showKey ? '🙈' : '👁'}
                  </button>
                </div>
                <p style={{ color: 'var(--c-muted)', fontSize: 10, marginTop: 5, lineHeight: 1.5 }}>
                  Get a key at replicate.com — billed per generation, hosts many open image models (Flux, SDXL, etc.).
                </p>
              </div>
              <div>
                <label style={labelStyle}>MODEL</label>
                <input style={fieldStyle} placeholder="owner/model-name" value={replicateModel} onChange={e => onReplicateModelChange(e.target.value)} spellCheck={false} />
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>PROMPT</label>
            <textarea rows={4} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="A cinematic shot of…"
              value={prompt} onChange={e => setPrompt(e.target.value)} />
          </div>

          {backend === 'comfyui' && (
            <div>
              <label style={labelStyle}>NEGATIVE PROMPT</label>
              <textarea rows={2} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="blurry, low quality…"
                value={negative} onChange={e => setNegative(e.target.value)} />
            </div>
          )}

          {backend === 'comfyui' && checkpoints.length > 0 && (
            <div>
              <label style={labelStyle}>CHECKPOINT</label>
              <select style={fieldStyle} value={ckpt} onChange={e => setCkpt(e.target.value)}>
                {checkpoints.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>SIZE</label>
            <div className="flex gap-1.5 flex-wrap">
              {(backend === 'comfyui' ? LOCAL_SIZES : HOSTED_SIZES).map(([val, lbl]) => (
                <button key={val} onClick={() => setSize(val)} style={{
                  padding: '5px 8px', fontSize: 10, borderRadius: 6,
                  background: size === val ? 'var(--c-glow)' : 'var(--c-card)',
                  border: `1px solid ${size === val ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  color: size === val ? 'var(--c-accent)' : 'var(--c-muted)', cursor: 'pointer',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {backend === 'comfyui' && (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label style={labelStyle}>STEPS</label>
                  <input type="number" min={1} max={150} style={fieldStyle} value={steps} onChange={e => setSteps(Number(e.target.value))} />
                </div>
                <div className="flex-1">
                  <label style={labelStyle}>CFG</label>
                  <input type="number" min={1} max={30} step={0.5} style={fieldStyle} value={cfg} onChange={e => setCfg(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label style={labelStyle}>SAMPLER</label>
                  <select style={fieldStyle} value={sampler} onChange={e => setSampler(e.target.value)}>
                    {SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label style={labelStyle}>SCHEDULER</label>
                  <select style={fieldStyle} value={scheduler} onChange={e => setScheduler(e.target.value)}>
                    {SCHEDULERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>SEED (blank = random)</label>
                <input type="number" style={fieldStyle} placeholder="random" value={seed} onChange={e => setSeed(e.target.value)} />
              </div>
            </>
          )}

          <button
            className="btn-primary rounded-xl py-2.5 font-orbitron tracking-wider flex items-center justify-center gap-2 mt-1"
            style={{ fontSize: 11, letterSpacing: '0.1em', opacity: (!prompt.trim() || busy || !ready) ? 0.5 : 1 }}
            disabled={!prompt.trim() || busy || !ready}
            onClick={generate}
          >
            {busy ? 'GENERATING…' : 'GENERATE'}
          </button>

          {error && (
            <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,51,102,0.06)', border: '1px solid rgba(255,51,102,0.25)' }}>
              <p style={{ color: 'var(--c-red)', fontSize: 11 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-auto p-6" style={{ position: 'relative' }}>
          {busy ? (
            <div className="flex flex-col items-center gap-3">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c-accent)', animation: 'blink 1s infinite' }} />
              <p style={{ color: 'var(--c-muted)', fontSize: 12 }}>
                {backend === 'hosted' ? 'Rendering with OpenAI…' : backend === 'replicate' ? 'Rendering with Replicate…' : 'Rendering with ComfyUI…'}
              </p>
            </div>
          ) : resultUrl ? (
            <>
              <img src={resultUrl} alt="Generated" style={{ maxWidth: '100%', maxHeight: '78%', borderRadius: 10, border: '1px solid var(--c-border)' }} />
              <div className="flex gap-2 mt-4">
                <button className="btn-icon" style={{ fontSize: 11, padding: '6px 14px', color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }} onClick={editResult}>
                  EDIT
                </button>
                <button className="btn-icon" style={{ fontSize: 11, padding: '6px 14px', color: 'var(--c-text)', border: '1px solid var(--c-border)' }} onClick={saveResult}>
                  SAVE
                </button>
                <button className="btn-icon" style={{ fontSize: 11, padding: '6px 14px', color: 'var(--c-text)', border: '1px solid var(--c-border)' }} onClick={generate}>
                  REGENERATE
                </button>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--c-muted)', fontSize: 12 }}>Enter a prompt and hit generate.</p>
          )}
        </div>
      </div>
    </FloatingPanel>
  );
}
