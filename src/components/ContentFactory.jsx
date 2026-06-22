import React, { useState, useEffect, useCallback, useRef } from 'react';
import useStore from '../store/useStore.js';
import FloatingPanel from './FloatingPanel.jsx';

const fieldStyle = {
  width: '100%', background: 'var(--c-card)', border: '1px solid var(--c-border)',
  borderRadius: 8, color: 'var(--c-text)', fontSize: 12, padding: '7px 9px',
};
const labelStyle = { color: 'var(--c-muted)', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', display: 'block', marginBottom: 5 };
const sectionStyle = { border: '1px solid var(--c-border)', borderRadius: 12, padding: 14, background: 'var(--c-card)' };
const sectionTitle = { color: 'var(--c-accent)', fontSize: 11, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };
const btnStyle = (disabled) => ({
  fontSize: 11, padding: '7px 14px', borderRadius: 8, color: 'var(--c-accent)',
  border: '1px solid var(--c-accent)', background: 'transparent', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
});

function Step({ n, title, children }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionTitle}>
        <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--c-glow)', border: '1px solid var(--c-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{n}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function ContentFactory({ onClose }) {
  const { settings, setSettings, setGenPromptPrefill, setImageGenOpen, setVideoGenOpen } = useStore();

  // ── Step 1: niche + trending topics ───────────────────────────────────────
  const [niche, setNiche] = useState('');
  const [source, setSource] = useState('reddit'); // 'reddit' | 'google'
  const [topics, setTopics] = useState([]);
  const [topicsBusy, setTopicsBusy] = useState(false);
  const [topicsError, setTopicsError] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [redditClientId, setRedditClientId] = useState(settings?.contentFactory?.reddit?.clientId || '');
  const [redditClientSecret, setRedditClientSecret] = useState(settings?.contentFactory?.reddit?.clientSecret || '');

  // ── Step 2: script ─────────────────────────────────────────────────────────
  const [script, setScript] = useState('');
  const [lengthSeconds, setLengthSeconds] = useState(45);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptError, setScriptError] = useState('');

  // ── Step 3: video prompt (visuals to pair with the script) ────────────────
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoPromptBusy, setVideoPromptBusy] = useState(false);
  const [videoPromptError, setVideoPromptError] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);

  // ── Step 4: voice ──────────────────────────────────────────────────────────
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState(settings?.contentFactory?.voiceName || '');
  const [rate, setRate] = useState(settings?.contentFactory?.rate ?? 0);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voicePath, setVoicePath] = useState(null);
  const [voiceDataUrl, setVoiceDataUrl] = useState(null);
  const [voiceDuration, setVoiceDuration] = useState(0);

  // ── Step 5: subtitles ──────────────────────────────────────────────────────
  const [subsBusy, setSubsBusy] = useState(false);
  const [subsError, setSubsError] = useState('');
  const [subsPath, setSubsPath] = useState(null);
  const [subsPreview, setSubsPreview] = useState('');

  // ── Step 6: export ─────────────────────────────────────────────────────────
  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const [videoPath, setVideoPath] = useState(null);
  const [videoDataUrl, setVideoDataUrl] = useState(null);
  const [savedMsg, setSavedMsg] = useState('');

  // ── Step 7: schedule to TikTok ─────────────────────────────────────────────
  const [tiktokStatus, setTiktokStatus] = useState({ connected: false });
  const [clientKey, setClientKey] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [caption, setCaption] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('SELF_ONLY');
  const [scheduledAt, setScheduledAt] = useState('');
  const [queue, setQueue] = useState([]);
  const [scheduleMsg, setScheduleMsg] = useState('');

  const persist = useCallback((patch) => {
    const updated = { ...settings, contentFactory: { ...(settings?.contentFactory || {}), ...patch } };
    setSettings(updated);
    window.zeus?.saveSettings(updated);
  }, [settings, setSettings]);

  const onRedditIdChange = useCallback((v) => { setRedditClientId(v); persist({ reddit: { clientId: v, clientSecret: redditClientSecret } }); }, [persist, redditClientSecret]);
  const onRedditSecretChange = useCallback((v) => { setRedditClientSecret(v); persist({ reddit: { clientId: redditClientId, clientSecret: v } }); }, [persist, redditClientId]);

  useEffect(() => {
    window.zeus?.cfVoices().then(res => {
      if (res?.voices) { setVoices(res.voices); setVoiceName(v => v || res.voices[0] || ''); }
    });
    refreshQueue();
    window.zeus?.tiktokStatus().then(s => s && setTiktokStatus(s));
  }, []);

  const refreshQueue = useCallback(() => {
    window.zeus?.tiktokQueue().then(q => setQueue(q || []));
  }, []);

  // ── Step 1 ──
  const findTopics = useCallback(async () => {
    if (!niche.trim()) return;
    setTopicsBusy(true); setTopicsError(''); setTopics([]); setSelectedTopic(null);
    const res = await window.zeus?.cfTrending(niche, source);
    setTopicsBusy(false);
    if (res?.error) { setTopicsError(res.error); return; }
    setTopics(res.topics || []);
  }, [niche, source]);

  // ── Step 2 ──
  const generateScript = useCallback(async () => {
    if (!selectedTopic) return;
    setScriptBusy(true); setScriptError('');
    const s = settings;
    const provider = s?.activeProvider || 'anthropic';
    const providerCfg = s?.providers?.[provider] || {};
    const res = await window.zeus?.cfScript({
      provider, model: providerCfg.model, apiKey: providerCfg.apiKey, baseURL: providerCfg.baseURL,
      niche, topic: selectedTopic.title, lengthSeconds,
    });
    setScriptBusy(false);
    if (res?.error) { setScriptError(res.error); return; }
    setScript(res.script || '');
  }, [selectedTopic, settings, niche, lengthSeconds]);

  // ── Step 3 ──
  const generateVideoPrompt = useCallback(async () => {
    if (!script.trim()) return;
    setVideoPromptBusy(true); setVideoPromptError('');
    const s = settings;
    const provider = s?.activeProvider || 'anthropic';
    const providerCfg = s?.providers?.[provider] || {};
    const res = await window.zeus?.cfVideoPrompt({
      provider, model: providerCfg.model, apiKey: providerCfg.apiKey, baseURL: providerCfg.baseURL,
      niche, topic: selectedTopic?.title || niche, script,
    });
    setVideoPromptBusy(false);
    if (res?.error) { setVideoPromptError(res.error); return; }
    setVideoPrompt(res.prompt || '');
  }, [script, selectedTopic, settings, niche]);

  const copyVideoPrompt = useCallback(() => {
    navigator.clipboard?.writeText(videoPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }, [videoPrompt]);

  const openInImageGen = useCallback(() => {
    setGenPromptPrefill(videoPrompt);
    setImageGenOpen(true);
  }, [videoPrompt, setGenPromptPrefill, setImageGenOpen]);

  const openInVideoGen = useCallback(() => {
    setGenPromptPrefill(videoPrompt);
    setVideoGenOpen(true);
  }, [videoPrompt, setGenPromptPrefill, setVideoGenOpen]);

  // ── Step 4 ──
  const onVoiceNameChange = useCallback((v) => { setVoiceName(v); persist({ voiceName: v }); }, [persist]);
  const onRateChange = useCallback((v) => { setRate(v); persist({ rate: v }); }, [persist]);

  const generateVoice = useCallback(async () => {
    if (!script.trim()) return;
    setVoiceBusy(true); setVoiceError(''); setVoicePath(null); setVoiceDataUrl(null);
    const res = await window.zeus?.cfVoice({ text: script, voiceName, rate });
    setVoiceBusy(false);
    if (res?.error) { setVoiceError(res.error); return; }
    setVoicePath(res.path); setVoiceDataUrl(res.dataUrl); setVoiceDuration(res.duration || 0);
  }, [script, voiceName, rate]);

  const saveVoice = useCallback(async () => {
    if (!voiceDataUrl) return;
    const res = await window.zeus?.cfSaveVoice(voiceDataUrl, 'zeus-voiceover.wav');
    if (res?.error) { alert('Save failed: ' + res.error); return; }
    if (res?.path) { setSavedMsg(`Saved → ${res.path}`); setTimeout(() => setSavedMsg(''), 4000); }
  }, [voiceDataUrl]);

  // ── Step 5 ──
  const generateSubtitles = useCallback(async () => {
    if (!script.trim()) return;
    setSubsBusy(true); setSubsError(''); setSubsPath(null);
    const res = await window.zeus?.cfSubtitles({ script, duration: voiceDuration });
    setSubsBusy(false);
    if (res?.error) { setSubsError(res.error); return; }
    setSubsPath(res.path); setSubsPreview(res.srt || '');
  }, [script, voiceDuration]);

  // ── Step 6 ──
  const pickImages = useCallback((files) => {
    const list = Array.from(files || []);
    list.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setImages(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = useCallback((i) => setImages(prev => prev.filter((_, idx) => idx !== i)), []);

  const exportVideo = useCallback(async () => {
    if (!voicePath) return;
    setExportBusy(true); setExportError(''); setVideoPath(null); setVideoDataUrl(null);
    const res = await window.zeus?.cfExport({
      images, audioPath: voicePath, srtPath: subsPath,
      width: 1080, height: 1920, durationSec: voiceDuration || 30,
    });
    setExportBusy(false);
    if (res?.error) { setExportError(res.error); return; }
    setVideoPath(res.path); setVideoDataUrl(res.dataUrl);
  }, [images, voicePath, subsPath, voiceDuration]);

  const saveVideo = useCallback(async () => {
    if (!videoDataUrl) return;
    const res = await window.zeus?.videogenSave(videoDataUrl, 'zeus-content-factory.mp4');
    if (res?.error) { alert('Save failed: ' + res.error); return; }
    if (res?.path) { setSavedMsg(`Saved → ${res.path}`); setTimeout(() => setSavedMsg(''), 4000); }
  }, [videoDataUrl]);

  // ── Step 7 ──
  const connectTikTok = useCallback(async () => {
    if (!clientKey || !clientSecret) return;
    setConnectBusy(true); setConnectError('');
    const res = await window.zeus?.tiktokConnect({ clientKey, clientSecret });
    setConnectBusy(false);
    if (res?.error) { setConnectError(res.error); return; }
    setTiktokStatus({ connected: true, openId: res.openId });
  }, [clientKey, clientSecret]);

  const disconnectTikTok = useCallback(async () => {
    await window.zeus?.tiktokDisconnect();
    setTiktokStatus({ connected: false });
  }, []);

  const scheduleUpload = useCallback(async () => {
    if (!videoPath) return;
    const ts = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
    const res = await window.zeus?.tiktokSchedule({ videoPath, caption, privacyLevel, scheduledAt: ts });
    if (res?.error) { setScheduleMsg(res.error); return; }
    setScheduleMsg('Queued.');
    setTimeout(() => setScheduleMsg(''), 3000);
    refreshQueue();
  }, [videoPath, caption, privacyLevel, scheduledAt, refreshQueue]);

  const cancelJob = useCallback(async (id) => {
    await window.zeus?.tiktokCancel(id);
    refreshQueue();
  }, [refreshQueue]);

  return (
    <FloatingPanel
      id="content-factory" title="CONTENT FACTORY" onClose={onClose}
      defaultWidth={820} defaultHeight={760}
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
        </svg>
      }
      headerExtra={
        <>
          {savedMsg && <span style={{ color: 'var(--c-green)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{savedMsg}</span>}
          <div className="flex-1" />
        </>
      }
    >
      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>

        <Step n={1} title="NICHE → TRENDING TOPICS">
          <div className="flex gap-1.5 mb-2">
            {[['reddit', 'Reddit'], ['google', 'Google News']].map(([val, lbl]) => (
              <button key={val} onClick={() => setSource(val)} style={{
                flex: 1, padding: '6px 6px', fontSize: 10.5, borderRadius: 6,
                background: source === val ? 'var(--c-glow)' : 'var(--c-card)',
                border: `1px solid ${source === val ? 'var(--c-accent)' : 'var(--c-border)'}`,
                color: source === val ? 'var(--c-accent)' : 'var(--c-muted)', cursor: 'pointer',
              }}>{lbl}</button>
            ))}
          </div>
          {source === 'reddit' && (!redditClientId || !redditClientSecret) ? (
            <div className="mb-3">
              <p style={{ color: 'var(--c-muted)', fontSize: 10.5, lineHeight: 1.6, marginBottom: 8 }}>
                Reddit blocks unauthenticated scraping now, so trending topics need a free Reddit app: go to reddit.com/prefs/apps → "create app" → type "script" → paste the client ID (under the app name) and secret here. (Name/description/about-url don't matter for this.)
              </p>
              <div className="flex gap-2">
                <input style={fieldStyle} placeholder="Reddit client ID" value={redditClientId} onChange={e => onRedditIdChange(e.target.value)} spellCheck={false} />
                <input style={fieldStyle} placeholder="Reddit client secret" type="password" value={redditClientSecret} onChange={e => onRedditSecretChange(e.target.value)} spellCheck={false} />
              </div>
            </div>
          ) : null}
          {source === 'google' && (
            <p style={{ color: 'var(--c-muted)', fontSize: 10.5, marginBottom: 8 }}>Google News RSS — free, no key needed.</p>
          )}
          <div className="flex gap-2 mb-2">
            <input style={fieldStyle} placeholder="e.g. home gym equipment" value={niche} onChange={e => setNiche(e.target.value)} />
            <button style={btnStyle(!niche.trim() || topicsBusy)} disabled={!niche.trim() || topicsBusy} onClick={findTopics}>
              {topicsBusy ? 'SEARCHING…' : 'FIND TOPICS'}
            </button>
          </div>
          {topicsError && <p style={{ color: 'var(--c-red)', fontSize: 11 }}>{topicsError}</p>}
          {topics.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {topics.map((t, i) => (
                <button key={i} onClick={() => setSelectedTopic(t)} className="text-left" style={{
                  padding: '7px 9px', borderRadius: 8, fontSize: 11.5,
                  background: selectedTopic === t ? 'var(--c-glow)' : 'var(--c-bg)',
                  border: `1px solid ${selectedTopic === t ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  color: 'var(--c-text)', cursor: 'pointer',
                }}>
                  {t.title}
                  <span style={{ color: 'var(--c-muted)', marginLeft: 8, fontSize: 10 }}>
                    {t.source}{typeof t.score === 'number' ? ` · ▲${t.score}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Step>

        <Step n={2} title="GENERATE SCRIPT">
          <div className="flex gap-2 mb-2 items-end">
            <div className="flex-1">
              <label style={labelStyle}>TARGET LENGTH (SECONDS)</label>
              <input type="number" min={15} max={180} style={fieldStyle} value={lengthSeconds} onChange={e => setLengthSeconds(Number(e.target.value))} />
            </div>
            <button style={btnStyle(!selectedTopic || scriptBusy)} disabled={!selectedTopic || scriptBusy} onClick={generateScript}>
              {scriptBusy ? 'WRITING…' : 'GENERATE SCRIPT'}
            </button>
          </div>
          {!selectedTopic && <p style={{ color: 'var(--c-muted)', fontSize: 11 }}>Pick a topic above first.</p>}
          {scriptError && <p style={{ color: 'var(--c-red)', fontSize: 11 }}>{scriptError}</p>}
          <textarea rows={6} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Generated script appears here — fully editable…"
            value={script} onChange={e => setScript(e.target.value)} />
        </Step>

        <Step n={3} title="GENERATE VIDEO PROMPT">
          <p style={{ color: 'var(--c-muted)', fontSize: 10.5, marginBottom: 8 }}>
            Turns the script into a visual prompt you can feed straight into Image or Video Generator for the footage.
          </p>
          <button style={{ ...btnStyle(!script.trim() || videoPromptBusy), marginBottom: 8 }} disabled={!script.trim() || videoPromptBusy} onClick={generateVideoPrompt}>
            {videoPromptBusy ? 'WRITING…' : 'GENERATE VIDEO PROMPT'}
          </button>
          {!script.trim() && <p style={{ color: 'var(--c-muted)', fontSize: 11 }}>Generate a script first.</p>}
          {videoPromptError && <p style={{ color: 'var(--c-red)', fontSize: 11 }}>{videoPromptError}</p>}
          {videoPrompt && (
            <>
              <textarea rows={4} style={{ ...fieldStyle, resize: 'vertical', marginBottom: 8 }} value={videoPrompt} onChange={e => setVideoPrompt(e.target.value)} />
              <div className="flex gap-2 flex-wrap">
                <button style={btnStyle(false)} onClick={copyVideoPrompt}>{promptCopied ? 'COPIED' : 'COPY'}</button>
                <button style={btnStyle(false)} onClick={openInImageGen}>OPEN IN IMAGE GENERATOR</button>
                <button style={btnStyle(false)} onClick={openInVideoGen}>OPEN IN VIDEO GENERATOR</button>
              </div>
            </>
          )}
        </Step>

        <Step n={4} title="GENERATE VOICE">
          <div className="flex gap-2 mb-2">
            <select style={fieldStyle} value={voiceName} onChange={e => onVoiceNameChange(e.target.value)}>
              {voices.length === 0 && <option value="">Default voice</option>}
              {voices.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input type="number" min={-10} max={10} style={{ ...fieldStyle, width: 70 }} value={rate} onChange={e => onRateChange(Number(e.target.value))} title="Speech rate (-10 to 10)" />
            <button style={btnStyle(!script.trim() || voiceBusy)} disabled={!script.trim() || voiceBusy} onClick={generateVoice}>
              {voiceBusy ? 'RENDERING…' : 'GENERATE VOICE'}
            </button>
          </div>
          {voiceError && <p style={{ color: 'var(--c-red)', fontSize: 11 }}>{voiceError}</p>}
          {voiceDataUrl && (
            <div className="flex flex-col gap-2">
              <audio controls src={voiceDataUrl} style={{ width: '100%' }} />
              <div className="flex items-center gap-2">
                <button style={btnStyle(false)} onClick={saveVoice}>SAVE WAV</button>
                {voiceDuration > 0 && <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>{voiceDuration.toFixed(1)}s rendered</span>}
              </div>
            </div>
          )}
        </Step>

        <Step n={5} title="GENERATE SUBTITLES">
          <button style={{ ...btnStyle(!script.trim() || !voiceDuration || subsBusy), marginBottom: 8 }} disabled={!script.trim() || !voiceDuration || subsBusy} onClick={generateSubtitles}>
            {subsBusy ? 'TIMING…' : 'GENERATE SUBTITLES'}
          </button>
          {!voiceDuration && <p style={{ color: 'var(--c-muted)', fontSize: 11 }}>Generate voice first so subtitles can be timed to it.</p>}
          {subsError && <p style={{ color: 'var(--c-red)', fontSize: 11 }}>{subsError}</p>}
          {subsPreview && (
            <pre style={{ ...fieldStyle, maxHeight: 140, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5 }}>{subsPreview}</pre>
          )}
        </Step>

        <Step n={6} title="EXPORT MP4">
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => pickImages(e.target.files)} />
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={img} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--c-border)' }} />
                <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--c-red)', color: '#fff', fontSize: 10, border: 'none', cursor: 'pointer' }}>×</button>
              </div>
            ))}
            <button onClick={() => fileInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: 6, border: '1px dashed var(--c-border)', color: 'var(--c-muted)', fontSize: 10, background: 'transparent', cursor: 'pointer' }}>
              + IMAGES
            </button>
          </div>
          <p style={{ color: 'var(--c-muted)', fontSize: 10, marginBottom: 8 }}>
            Optional — images slideshow as the background (e.g. from Image Generator). Leave empty for a plain background.
          </p>
          <button style={btnStyle(!voicePath || exportBusy)} disabled={!voicePath || exportBusy} onClick={exportVideo}>
            {exportBusy ? 'EXPORTING…' : 'EXPORT MP4'}
          </button>
          {!voicePath && <p style={{ color: 'var(--c-muted)', fontSize: 11, marginTop: 6 }}>Generate voice first.</p>}
          {exportError && <p style={{ color: 'var(--c-red)', fontSize: 11, marginTop: 6 }}>{exportError}</p>}
          {videoDataUrl && (
            <div className="flex flex-col gap-2 mt-3">
              <video src={videoDataUrl} controls style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 10, border: '1px solid var(--c-border)' }} />
              <div className="flex gap-2">
                <button style={btnStyle(false)} onClick={saveVideo}>SAVE MP4</button>
              </div>
            </div>
          )}
        </Step>

        <Step n={7} title="SCHEDULE TIKTOK UPLOAD">
          {!tiktokStatus.connected ? (
            <>
              <p style={{ color: 'var(--c-muted)', fontSize: 10.5, lineHeight: 1.6, marginBottom: 8 }}>
                Create an app at developers.tiktok.com, add a redirect URI matching <code>http://127.0.0.1:53931/callback</code>, and paste its client key/secret here.
                Until your app is audited, TikTok only allows posting privately (SELF_ONLY).
              </p>
              <div className="flex gap-2 mb-2">
                <input style={fieldStyle} placeholder="Client key" value={clientKey} onChange={e => setClientKey(e.target.value)} spellCheck={false} />
                <input style={fieldStyle} placeholder="Client secret" type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} spellCheck={false} />
              </div>
              <button style={btnStyle(!clientKey || !clientSecret || connectBusy)} disabled={!clientKey || !clientSecret || connectBusy} onClick={connectTikTok}>
                {connectBusy ? 'CONNECTING…' : 'CONNECT TIKTOK'}
              </button>
              {connectError && <p style={{ color: 'var(--c-red)', fontSize: 11, marginTop: 6 }}>{connectError}</p>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="status-dot online" /><span style={{ color: 'var(--c-green)', fontSize: 11 }}>TikTok connected</span>
                <div className="flex-1" />
                <button style={{ fontSize: 10.5, padding: '4px 10px', color: 'var(--c-muted)', border: '1px solid var(--c-border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} onClick={disconnectTikTok}>DISCONNECT</button>
              </div>
              <textarea rows={2} style={{ ...fieldStyle, resize: 'vertical', marginBottom: 8 }} placeholder="Caption…" value={caption} onChange={e => setCaption(e.target.value)} />
              <div className="flex gap-2 mb-2">
                <select style={fieldStyle} value={privacyLevel} onChange={e => setPrivacyLevel(e.target.value)}>
                  <option value="SELF_ONLY">Private (SELF_ONLY)</option>
                  <option value="PUBLIC_TO_EVERYONE">Public (requires audited app)</option>
                </select>
                <input type="datetime-local" style={fieldStyle} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              </div>
              <button style={btnStyle(!videoPath)} disabled={!videoPath} onClick={scheduleUpload}>
                SCHEDULE UPLOAD
              </button>
              {!videoPath && <p style={{ color: 'var(--c-muted)', fontSize: 11, marginTop: 6 }}>Export an MP4 first.</p>}
              {scheduleMsg && <p style={{ color: 'var(--c-green)', fontSize: 11, marginTop: 6 }}>{scheduleMsg}</p>}

              {queue.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-3">
                  {queue.map(j => (
                    <div key={j.id} className="flex items-center gap-2" style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--c-border)', fontSize: 11 }}>
                      <span style={{ color: j.status === 'failed' ? 'var(--c-red)' : j.status === 'done' ? 'var(--c-green)' : 'var(--c-muted)' }}>{j.status}</span>
                      <span style={{ color: 'var(--c-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.caption || '(no caption)'}</span>
                      <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>{new Date(j.scheduledAt).toLocaleString()}</span>
                      {j.status === 'queued' && (
                        <button onClick={() => cancelJob(j.id)} style={{ color: 'var(--c-red)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11 }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Step>
      </div>
    </FloatingPanel>
  );
}
