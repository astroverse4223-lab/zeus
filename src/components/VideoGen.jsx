import React, { useState, useEffect, useCallback, useRef } from 'react';
import useStore from '../store/useStore.js';
import FloatingPanel from './FloatingPanel.jsx';

const SIZES = [['512x512','512²'],['768x512','768×512'],['512x768','512×768'],['576x1024','576×1024']];

const fieldStyle = {
  width: '100%', background: 'var(--c-card)', border: '1px solid var(--c-border)',
  borderRadius: 8, color: 'var(--c-text)', fontSize: 12, padding: '7px 9px',
};
const labelStyle = { color: 'var(--c-muted)', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', display: 'block', marginBottom: 5 };

export default function VideoGen({ onClose }) {
  const { settings, setSettings, genPromptPrefill, setGenPromptPrefill } = useStore();

  const [backend, setBackend] = useState(settings?.videoGen?.backend || 'comfyui'); // 'comfyui' | 'hosted'
  const [mode, setMode] = useState('txt2vid'); // 'txt2vid' | 'img2vid'
  const [apiKey, setApiKey] = useState(settings?.videoGen?.replicateApiKey || '');
  const [model, setModel] = useState(settings?.videoGen?.replicateModel || 'minimax/video-01');
  const [showKey, setShowKey] = useState(false);

  const [status, setStatus] = useState({ checking: true });
  const [checkpoints, setCheckpoints] = useState([]);
  const [ckpt, setCkpt] = useState('');
  const [clipNames, setClipNames] = useState([]);
  const [clipName, setClipName] = useState(settings?.videoGen?.clipName || '');

  const [prompt, setPrompt] = useState(genPromptPrefill || '');
  const [negative, setNegative] = useState('');
  const [size, setSize] = useState('512x512');

  // Content Factory hands off a generated prompt via the store, then opens this
  // panel — consume it once on mount so it doesn't leak into the next open.
  useEffect(() => {
    if (genPromptPrefill) setGenPromptPrefill(null);
  }, []);
  const [frames, setFrames] = useState(25);
  const [fps, setFps] = useState(8);
  const [steps, setSteps] = useState(20);
  const [cfg, setCfg] = useState(6);
  const [motionBucketId, setMotionBucketId] = useState(127);
  const [seed, setSeed] = useState('');

  const [sourceImage, setSourceImage] = useState(null);
  const fileInputRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [savedMsg, setSavedMsg] = useState('');

  const persist = useCallback((patch) => {
    const updated = { ...settings, videoGen: { ...(settings?.videoGen || {}), ...patch } };
    setSettings(updated);
    window.zeus?.saveSettings(updated);
  }, [settings, setSettings]);

  const selectBackend = useCallback((b) => { setBackend(b); persist({ backend: b }); }, [persist]);
  const onApiKeyChange = useCallback((v) => { setApiKey(v); persist({ replicateApiKey: v }); }, [persist]);
  const onModelChange = useCallback((v) => { setModel(v); persist({ replicateModel: v }); }, [persist]);
  const onClipNameChange = useCallback((v) => { setClipName(v); persist({ clipName: v }); }, [persist]);

  const checkStatus = useCallback(async () => {
    setStatus({ checking: true });
    const res = await window.zeus?.videogenStatus();
    if (res?.ok) {
      setStatus({ checking: false, ok: true, img2vidSupported: res.img2vidSupported, txt2vidSupported: res.txt2vidSupported });
      const list = mode === 'img2vid' ? res.checkpoints : res.txt2vidCheckpoints;
      setCheckpoints(list || []);
      setCkpt(c => c || list?.[0] || '');
      setClipNames(res.clipNames || []);
      setClipName(c => c || res.clipNames?.[0] || '');
    } else {
      setStatus({ checking: false, ok: false, error: res?.error || 'ComfyUI unreachable' });
    }
  }, [mode]);

  useEffect(() => { if (backend === 'comfyui') checkStatus(); }, [backend, mode, checkStatus]);

  const pickImage = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSourceImage(reader.result);
    reader.readAsDataURL(file);
  }, []);

  const generate = useCallback(async () => {
    if (busy) return;
    if (mode === 'txt2vid' && !prompt.trim()) return;
    if (mode === 'img2vid' && !sourceImage) return;
    setBusy(true); setError(''); setResultUrl(null);
    let res;
    if (backend === 'hosted') {
      res = await window.zeus?.videogenGenerateHosted({
        prompt, sourceImage: mode === 'img2vid' ? sourceImage : null, model, apiKey,
      });
    } else {
      const [width, height] = size.split('x').map(Number);
      res = await window.zeus?.videogenGenerate({
        mode, prompt, negative, ckpt, clipName, width, height, frames, fps, steps, cfg,
        motionBucketId, sourceImage, seed: seed ? Number(seed) : undefined,
      });
    }
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setResultUrl(res.dataUrl);
  }, [backend, mode, prompt, negative, ckpt, clipName, size, frames, fps, steps, cfg, motionBucketId, sourceImage, seed, model, apiKey, busy]);

  const saveResult = useCallback(async () => {
    if (!resultUrl) return;
    const res = await window.zeus?.videogenSave(resultUrl, 'zeus-generated-video');
    if (res?.error) { alert('Save failed: ' + res.error); return; }
    if (res?.path) { setSavedMsg(`Saved → ${res.path}`); setTimeout(() => setSavedMsg(''), 4000); }
  }, [resultUrl]);

  const comfyModeSupported = mode === 'img2vid' ? status.img2vidSupported : status.txt2vidSupported;
  const ready = backend === 'hosted' ? !!apiKey && !!model : (status.ok && comfyModeSupported);
  const isWebp = resultUrl?.startsWith('data:image/webp');
  const needsClip = backend === 'comfyui' && mode === 'txt2vid' && !clipName;
  const generateDisabled = busy || !ready || needsClip
    || (mode === 'txt2vid' && !prompt.trim())
    || (mode === 'img2vid' && !sourceImage);

  return (
    <FloatingPanel
      id="video-gen" title="VIDEO GENERATOR" onClose={onClose}
      defaultWidth={1040} defaultHeight={700}
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      }
      headerExtra={
        <>
          {backend === 'comfyui' ? (
            status.checking ? (
              <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>checking ComfyUI…</span>
            ) : status.ok ? (
              comfyModeSupported ? (
                <span style={{ color: 'var(--c-green)', fontSize: 10 }} className="flex items-center gap-1.5">
                  <span className="status-dot online" /> ComfyUI connected
                </span>
              ) : (
                <span style={{ color: 'var(--c-red)', fontSize: 10 }}>
                  ComfyUI is missing {mode === 'img2vid' ? 'SVD' : 'LTX-Video'} nodes — update ComfyUI or install the model
                </span>
              )
            ) : (
              <span style={{ color: 'var(--c-red)', fontSize: 10 }}>ComfyUI unreachable — start it, then retry</span>
            )
          ) : (
            <span style={{ color: apiKey ? 'var(--c-green)' : 'var(--c-muted)', fontSize: 10 }}>
              {apiKey ? 'API key set' : 'Enter your Replicate API key below'}
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
              {[['comfyui','Local (ComfyUI)'],['hosted','Hosted (Replicate)']].map(([val, lbl]) => (
                <button key={val} onClick={() => selectBackend(val)} style={{
                  flex: 1, padding: '6px 6px', fontSize: 10.5, borderRadius: 6,
                  background: backend === val ? 'var(--c-glow)' : 'var(--c-card)',
                  border: `1px solid ${backend === val ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  color: backend === val ? 'var(--c-accent)' : 'var(--c-muted)', cursor: 'pointer',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>MODE</label>
            <div className="flex gap-1.5">
              {[['txt2vid','Text → Video'],['img2vid','Image → Video']].map(([val, lbl]) => (
                <button key={val} onClick={() => setMode(val)} style={{
                  flex: 1, padding: '6px 6px', fontSize: 10.5, borderRadius: 6,
                  background: mode === val ? 'var(--c-glow)' : 'var(--c-card)',
                  border: `1px solid ${mode === val ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  color: mode === val ? 'var(--c-accent)' : 'var(--c-muted)', cursor: 'pointer',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {backend === 'hosted' && (
            <>
              <div>
                <label style={labelStyle}>REPLICATE API KEY</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    style={fieldStyle}
                    placeholder="r8_..."
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
                  Get a key at replicate.com — billed per generation, no local setup needed.
                </p>
              </div>
              <div>
                <label style={labelStyle}>MODEL</label>
                <input style={fieldStyle} placeholder="owner/model-name" value={model} onChange={e => onModelChange(e.target.value)} spellCheck={false} />
              </div>
            </>
          )}

          {mode === 'txt2vid' ? (
            <div>
              <label style={labelStyle}>PROMPT</label>
              <textarea rows={4} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="A cinematic shot of…"
                value={prompt} onChange={e => setPrompt(e.target.value)} />
            </div>
          ) : (
            <div>
              <label style={labelStyle}>SOURCE IMAGE</label>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => pickImage(e.target.files?.[0])} />
              {sourceImage ? (
                <div className="flex flex-col gap-2">
                  <img src={sourceImage} alt="source" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--c-border)' }} />
                  <button className="btn-icon" style={{ fontSize: 10.5, padding: '5px 8px', color: 'var(--c-muted)' }} onClick={() => fileInputRef.current?.click()}>
                    CHANGE IMAGE
                  </button>
                </div>
              ) : (
                <button className="btn-icon w-full" style={{ fontSize: 10.5, padding: '8px', color: 'var(--c-accent)', border: '1px dashed var(--c-border)' }} onClick={() => fileInputRef.current?.click()}>
                  CHOOSE IMAGE
                </button>
              )}
              {backend === 'hosted' && (
                <div className="mt-2">
                  <label style={labelStyle}>PROMPT (optional)</label>
                  <textarea rows={2} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Guide the motion…"
                    value={prompt} onChange={e => setPrompt(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {backend === 'comfyui' && mode === 'txt2vid' && (
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

          {backend === 'comfyui' && mode === 'txt2vid' && (
            <div>
              <label style={labelStyle}>TEXT ENCODER (CLIP)</label>
              {clipNames.length > 0 ? (
                <select style={fieldStyle} value={clipName} onChange={e => onClipNameChange(e.target.value)}>
                  {clipNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input style={fieldStyle} placeholder="t5xxl_fp16.safetensors" value={clipName} onChange={e => onClipNameChange(e.target.value)} spellCheck={false} />
              )}
              <p style={{ color: 'var(--c-muted)', fontSize: 10, marginTop: 5, lineHeight: 1.5 }}>
                LTX-Video checkpoints don't bundle a text encoder — download a T5 CLIP file (e.g. t5xxl_fp16.safetensors) into ComfyUI's clip folder.
              </p>
            </div>
          )}

          {backend === 'comfyui' && (
            <>
              <div>
                <label style={labelStyle}>SIZE</label>
                <div className="flex gap-1.5 flex-wrap">
                  {SIZES.map(([val, lbl]) => (
                    <button key={val} onClick={() => setSize(val)} style={{
                      padding: '5px 8px', fontSize: 10, borderRadius: 6,
                      background: size === val ? 'var(--c-glow)' : 'var(--c-card)',
                      border: `1px solid ${size === val ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      color: size === val ? 'var(--c-accent)' : 'var(--c-muted)', cursor: 'pointer',
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label style={labelStyle}>FRAMES</label>
                  <input type="number" min={6} max={120} style={fieldStyle} value={frames} onChange={e => setFrames(Number(e.target.value))} />
                </div>
                <div className="flex-1">
                  <label style={labelStyle}>FPS</label>
                  <input type="number" min={4} max={30} style={fieldStyle} value={fps} onChange={e => setFps(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label style={labelStyle}>STEPS</label>
                  <input type="number" min={1} max={100} style={fieldStyle} value={steps} onChange={e => setSteps(Number(e.target.value))} />
                </div>
                <div className="flex-1">
                  <label style={labelStyle}>CFG</label>
                  <input type="number" min={1} max={20} step={0.5} style={fieldStyle} value={cfg} onChange={e => setCfg(Number(e.target.value))} />
                </div>
              </div>

              {mode === 'img2vid' && (
                <div>
                  <label style={labelStyle}>MOTION (1–255, higher = more movement)</label>
                  <input type="number" min={1} max={255} style={fieldStyle} value={motionBucketId} onChange={e => setMotionBucketId(Number(e.target.value))} />
                </div>
              )}

              <div>
                <label style={labelStyle}>SEED (blank = random)</label>
                <input type="number" style={fieldStyle} placeholder="random" value={seed} onChange={e => setSeed(e.target.value)} />
              </div>
            </>
          )}

          <button
            className="btn-primary rounded-xl py-2.5 font-orbitron tracking-wider flex items-center justify-center gap-2 mt-1"
            style={{
              fontSize: 11, letterSpacing: '0.1em',
              opacity: generateDisabled ? 0.5 : 1,
            }}
            disabled={generateDisabled}
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
              <p style={{ color: 'var(--c-muted)', fontSize: 12 }}>{backend === 'hosted' ? 'Rendering with Replicate…' : 'Rendering with ComfyUI…'} (this can take a while)</p>
            </div>
          ) : resultUrl ? (
            <>
              {isWebp ? (
                <img src={resultUrl} alt="Generated video" style={{ maxWidth: '100%', maxHeight: '78%', borderRadius: 10, border: '1px solid var(--c-border)' }} />
              ) : (
                <video src={resultUrl} controls autoPlay loop style={{ maxWidth: '100%', maxHeight: '78%', borderRadius: 10, border: '1px solid var(--c-border)' }} />
              )}
              <div className="flex gap-2 mt-4">
                <button className="btn-icon" style={{ fontSize: 11, padding: '6px 14px', color: 'var(--c-text)', border: '1px solid var(--c-border)' }} onClick={saveResult}>
                  SAVE
                </button>
                <button className="btn-icon" style={{ fontSize: 11, padding: '6px 14px', color: 'var(--c-text)', border: '1px solid var(--c-border)' }} onClick={generate}>
                  REGENERATE
                </button>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--c-muted)', fontSize: 12 }}>
              {mode === 'txt2vid' ? 'Enter a prompt and hit generate.' : 'Choose a source image and hit generate.'}
            </p>
          )}
        </div>
      </div>
    </FloatingPanel>
  );
}
