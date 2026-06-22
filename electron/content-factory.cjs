// ── Content Factory: niche → trending topic → script → voice → subtitles → MP4 → TikTok ──
// Registers its IPC handlers onto the shared ipcMain/getSettings()/shell instances passed in
// from main.cjs, mirroring the rest of the app's "feature module" style instead of
// dumping thousands more lines into main.cjs directly.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const ffmpegPath = require('ffmpeg-static');

function registerContentFactory({ ipcMain, app, shell, dialog, getSettings, saveSettings, getMainWindow }) {
  const workDir = () => {
    const dir = path.join(app.getPath('temp'), 'zeus-content-factory');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  // ── Trending topics via Reddit's OAuth API ───────────────────────────────────
  // Reddit now blocks unauthenticated scraping of reddit.com/*.json with a 403
  // bot-check page regardless of headers — confirmed by testing directly. The
  // client-credentials grant is the free workaround: no user login/redirect,
  // just a "script" app registered at reddit.com/prefs/apps.
  const REDDIT_UA = 'ZeusContentFactory/1.0 (desktop app, by /u/zeus-content-factory)';
  let redditToken = null; // { accessToken, expiresAt }

  async function getRedditToken() {
    const { clientId, clientSecret } = getSettings()?.contentFactory?.reddit || {};
    if (!clientId || !clientSecret) throw new Error('Add a Reddit client ID/secret first (free at reddit.com/prefs/apps)');
    if (redditToken && redditToken.expiresAt > Date.now() + 5000) return redditToken.accessToken;
    const r = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_UA,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || !json.access_token) throw new Error(json?.message || `Reddit auth failed (${r.status}) — check your client ID/secret`);
    redditToken = { accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 };
    return redditToken.accessToken;
  }

  async function fetchRedditTopics(niche) {
    const token = await getRedditToken();
    const url = `https://oauth.reddit.com/search?q=${encodeURIComponent(niche)}&sort=top&t=week&limit=20`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': REDDIT_UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Reddit returned ${r.status}`);
    const json = await r.json();
    return (json?.data?.children || [])
      .map(p => p.data)
      .filter(d => d?.title)
      .map(d => ({
        title: d.title, source: `r/${d.subreddit}`, score: d.score,
        url: `https://reddit.com${d.permalink}`,
      }))
      .sort((a, b) => b.score - a.score);
  }

  // Google News RSS — no API key, no auth, confirmed working (unlike the dead
  // unofficial Google Trends "dailytrends" endpoint, which 404s as of this build).
  // Plain XML with no CDATA wrapping, so a small regex scan is enough — no need
  // to pull in a full XML parser dependency for this.
  function decodeXmlEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }

  async function fetchGoogleNewsTopics(niche) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(niche)}&hl=en-US&gl=US&ceid=US:en`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`Google News returned ${r.status}`);
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.map(([, block]) => {
      const title = decodeXmlEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const sourceName = decodeXmlEntities(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '');
      // Titles come back as "Headline - Source Name" — drop the trailing source tag.
      const cleanTitle = sourceName && title.endsWith(sourceName) ? title.slice(0, -sourceName.length).replace(/\s*-\s*$/, '') : title;
      return { title: cleanTitle, source: sourceName || 'Google News', score: null, url: link };
    }).filter(t => t.title);
  }

  ipcMain.handle('zeus:contentfactory-trending', async (_, { niche, source }) => {
    if (!niche?.trim()) return { error: 'Enter a niche first' };
    try {
      const topics = source === 'google' ? await fetchGoogleNewsTopics(niche) : await fetchRedditTopics(niche);
      if (!topics.length) return { error: 'No trending results for that niche — try a broader term' };
      return { topics };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Script generation — reuses whichever chat provider/key the user already has ──
  // Shared one-shot text-generation call across whichever provider the user already
  // has configured for chat — mirrors main.cjs's zeus:generate-title branching so
  // script/prompt generation doesn't need its own separate provider wiring.
  async function callTextProvider({ provider, model, apiKey, baseURL, sys, userMsg, maxTokens }) {
    if (provider === 'anthropic' && apiKey) {
      const { Anthropic } = require('@anthropic-ai/sdk');
      const r = await new Anthropic({ apiKey }).messages.create({
        model: model || 'claude-opus-4-8', max_tokens: maxTokens,
        system: sys, messages: [{ role: 'user', content: userMsg }],
      });
      return (r.content?.[0]?.text || '').trim();
    }
    if (provider === 'openai' && apiKey) {
      const { OpenAI } = require('openai');
      const r = await new OpenAI({ apiKey }).chat.completions.create({
        model: model || 'gpt-4o', max_tokens: maxTokens,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      });
      return (r.choices?.[0]?.message?.content || '').trim();
    }
    if (provider === 'gemini' && apiKey) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const m = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: model || 'gemini-2.0-flash', systemInstruction: sys });
      return ((await m.generateContent(userMsg)).response.text() || '').trim();
    }
    if (provider === 'ollama') {
      const { OpenAI } = require('openai');
      const r = await new OpenAI({ apiKey: 'ollama', baseURL: baseURL || 'http://localhost:11434/v1' }).chat.completions.create({
        model: model || 'llama3.2', max_tokens: maxTokens,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      });
      return (r.choices?.[0]?.message?.content || '').trim();
    }
    throw new Error('No AI provider configured — add an API key in Settings first');
  }

  ipcMain.handle('zeus:contentfactory-script', async (_, { provider, model, apiKey, baseURL, niche, topic, lengthSeconds }) => {
    const seconds = lengthSeconds || 60;
    const words = Math.round(seconds * 2.5); // ~150 wpm spoken
    const sys = `You write tight, punchy short-form video voiceover scripts (TikTok/Shorts style) for the niche "${niche}". Write ONLY the spoken narration text — no scene directions, no timestamps, no markdown, no preamble. Aim for about ${words} words (~${seconds}s spoken).`;
    try {
      const script = await callTextProvider({ provider, model, apiKey, baseURL, sys, userMsg: `Topic: ${topic}`, maxTokens: 1024 });
      return { script };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Video prompt generator: turns a script into an AI image/video-gen prompt ──
  ipcMain.handle('zeus:contentfactory-video-prompt', async (_, { provider, model, apiKey, baseURL, niche, topic, script }) => {
    const sys = `You write concise, vivid prompts for AI image/video generators (Stable Diffusion / Stable Video Diffusion / LTX-Video style). Given a short-form video script for the niche "${niche}", output ONE single prompt describing the visuals that should accompany it: subject, setting, camera angle, lighting, mood, and motion if relevant. Output ONLY the prompt text — no preamble, no quotes, no markdown, one paragraph.`;
    const userMsg = `Topic: ${topic}\n\nScript:\n${script}`;
    try {
      const prompt = await callTextProvider({ provider, model, apiKey, baseURL, sys, userMsg, maxTokens: 300 });
      return { prompt };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Voiceover via Windows SAPI (System.Speech), rendered straight to a .wav file ──
  ipcMain.handle('zeus:contentfactory-voices', async () => {
    try {
      const ps = 'Add-Type -AssemblyName System.Speech; ' +
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ' +
        '$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }';
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true });
      const voices = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      return { voices };
    } catch (err) {
      return { error: err.message };
    }
  });

  function wavDurationSeconds(filePath) {
    const buf = fs.readFileSync(filePath);
    const numChannels = buf.readUInt16LE(22);
    const sampleRate = buf.readUInt32LE(24);
    const bitsPerSample = buf.readUInt16LE(34);
    let offset = 12, dataSize = buf.length - 44;
    while (offset < buf.length - 8) {
      const chunkId = buf.toString('ascii', offset, offset + 4);
      const chunkSize = buf.readUInt32LE(offset + 4);
      if (chunkId === 'data') { dataSize = chunkSize; break; }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
    return bytesPerSecond > 0 ? dataSize / bytesPerSecond : 0;
  }

  ipcMain.handle('zeus:contentfactory-voice', async (_, { text, voiceName, rate }) => {
    if (!text?.trim()) return { error: 'No script text to speak' };
    try {
      const dir = workDir();
      const outPath = path.join(dir, `voice-${Date.now()}.wav`);
      // LLM-generated script text can contain arbitrary quotes/punctuation that's
      // brittle to embed inline in a PowerShell command string (one bad escape and
      // the whole command fails to parse, e.g. "missing end parenthesis"). Writing
      // it to a file and having PowerShell read it sidesteps quoting entirely —
      // only the (fully-controlled) file paths need minimal escaping below.
      const textPath = path.join(dir, `voice-text-${Date.now()}.txt`);
      fs.writeFileSync(textPath, text, 'utf8');
      const escapedVoice = (voiceName || '').replace(/'/g, "''");
      const escapedPath = outPath.replace(/'/g, "''");
      const escapedTextPath = textPath.replace(/'/g, "''");
      // A SelectVoice() call with a name that doesn't exactly match an installed
      // voice throws a terminating error and aborts the whole script — wrap it so
      // a stale/mismatched voice name falls back to the default instead of
      // failing the entire render. Everything is wrapped in try/catch so the real
      // failure reason lands on stderr as plain text instead of a noisy .NET
      // stack trace (which was getting truncated before it reached the UI).
      const ps = [
        'try {',
        'Add-Type -AssemblyName System.Speech;',
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
        escapedVoice ? `try { $s.SelectVoice('${escapedVoice}') } catch { Write-Warning "Voice '${escapedVoice}' not found, using default" };` : '',
        `$s.Rate = ${Number(rate) || 0};`,
        // SetOutputToWaveFile(path) with no explicit format can emit a WAV header
        // variant that browsers' decoders reject outright (stuck at 0:00, no
        // playback) even though the raw bytes are fine. Forcing a plain 16-bit
        // PCM mono format guarantees a header every decoder understands.
        '$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono);',
        `$s.SetOutputToWaveFile('${escapedPath}', $fmt);`,
        `$text = [System.IO.File]::ReadAllText('${escapedTextPath}');`,
        '$s.Speak($text);',
        '$s.Dispose();',
        '} catch { Write-Error $_.Exception.Message; exit 1 }',
      ].join(' ');
      try {
        await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
      } catch (psErr) {
        const reason = (psErr.stderr || psErr.message || '').toString().trim().split(/\r?\n/).pop();
        return { error: `Voice synthesis failed: ${reason || 'unknown PowerShell error'}` };
      } finally {
        fs.rmSync(textPath, { force: true });
      }
      if (!fs.existsSync(outPath)) return { error: 'Voice synthesis failed — no output file produced' };
      const duration = wavDurationSeconds(outPath);
      const buf = fs.readFileSync(outPath);
      return { path: outPath, dataUrl: `data:audio/wav;base64,${buf.toString('base64')}`, duration };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('zeus:contentfactory-save-voice', async (_, { dataUrl, defaultName }) => {
    try {
      const res = await dialog.showSaveDialog(getMainWindow(), {
        title: 'Save voiceover',
        defaultPath: defaultName || 'zeus-voiceover.wav',
        filters: [{ name: 'Audio', extensions: ['wav'] }],
      });
      if (res.canceled || !res.filePath) return { canceled: true };
      const base64 = String(dataUrl).replace(/^data:audio\/\w+;base64,/, '');
      fs.writeFileSync(res.filePath, Buffer.from(base64, 'base64'));
      return { path: res.filePath };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── Subtitles: proportional sentence timing against the rendered voice duration ──
  function formatSrtTime(seconds) {
    const ms = Math.max(0, Math.round(seconds * 1000));
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))},${pad(ms % 1000, 3)}`;
  }

  ipcMain.handle('zeus:contentfactory-subtitles', async (_, { script, duration }) => {
    if (!script?.trim()) return { error: 'No script text' };
    try {
      const sentences = script.match(/[^.!?]+[.!?]*/g)?.map(s => s.trim()).filter(Boolean) || [script.trim()];
      const totalChars = sentences.reduce((a, s) => a + s.length, 0) || 1;
      const totalDuration = duration || sentences.length * 3;
      let t = 0;
      const blocks = sentences.map((s, i) => {
        const segDuration = (s.length / totalChars) * totalDuration;
        const start = t, end = t + segDuration;
        t = end;
        return `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${s}\n`;
      });
      const srt = blocks.join('\n');
      const outPath = path.join(workDir(), `subs-${Date.now()}.srt`);
      fs.writeFileSync(outPath, srt, 'utf8');
      return { srt, path: outPath };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── MP4 export: image slideshow (or solid background) + voice track + burned subs ──
  function escapeFfmpegFilterPath(p) {
    return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  }

  function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args, { windowsHide: true });
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-1500)}`)));
      proc.on('error', reject);
    });
  }

  ipcMain.handle('zeus:contentfactory-export', async (_, { images, audioPath, srtPath, width, height, durationSec }) => {
    try {
      const dir = workDir();
      const w = width || 1080, h = height || 1920;
      const duration = durationSec || 30;
      const outPath = path.join(dir, `zeus-video-${Date.now()}.mp4`);
      const args = [];

      if (images?.length > 0) {
        const perImage = duration / images.length;
        const savedPaths = images.map((dataUrl, i) => {
          const m = /^data:(.+);base64,(.+)$/.exec(dataUrl);
          const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
          const p = path.join(dir, `img-${Date.now()}-${i}.${ext}`);
          fs.writeFileSync(p, Buffer.from(m[2], 'base64'));
          return p;
        });
        const listPath = path.join(dir, `list-${Date.now()}.txt`);
        const listContent = savedPaths.map(p => `file '${p.replace(/\\/g, '/')}'\nduration ${perImage.toFixed(3)}`).join('\n')
          + `\nfile '${savedPaths[savedPaths.length - 1].replace(/\\/g, '/')}'\n`;
        fs.writeFileSync(listPath, listContent, 'utf8');
        args.push('-f', 'concat', '-safe', '0', '-i', listPath);
      } else {
        args.push('-f', 'lavfi', '-i', `color=c=0x0b0f1a:s=${w}x${h}:d=${duration}`);
      }
      args.push('-i', audioPath);

      let vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
      if (srtPath) vf += `,subtitles='${escapeFfmpegFilterPath(srtPath)}'`;

      args.push(
        '-vf', vf,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest',
        '-y', outPath,
      );

      await runFfmpeg(args);
      const buf = fs.readFileSync(outPath);
      return { path: outPath, dataUrl: `data:video/mp4;base64,${buf.toString('base64')}` };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ── TikTok: OAuth connect, direct-post upload, and a local schedule queue ────────
  const TIKTOK_REDIRECT_PORT = 53931;
  const TIKTOK_REDIRECT_URI = `http://127.0.0.1:${TIKTOK_REDIRECT_PORT}/callback`;
  let tiktokAuthServer = null;

  ipcMain.handle('zeus:tiktok-redirect-uri', () => TIKTOK_REDIRECT_URI);

  ipcMain.handle('zeus:tiktok-connect', async (_, { clientKey, clientSecret }) => {
    if (!clientKey || !clientSecret) return { error: 'Missing TikTok client key/secret' };
    return new Promise((resolve) => {
      if (tiktokAuthServer) { try { tiktokAuthServer.close(); } catch {} tiktokAuthServer = null; }
      const state = 'zeus-' + Date.now();
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (tiktokAuthServer) { try { tiktokAuthServer.close(); } catch {} tiktokAuthServer = null; }
        resolve(result);
      };
      tiktokAuthServer = http.createServer(async (req, res) => {
        try {
          const u = new URL(req.url, TIKTOK_REDIRECT_URI);
          if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
          const code = u.searchParams.get('code');
          const returnedState = u.searchParams.get('state');
          if (!code || returnedState !== state) {
            res.writeHead(400); res.end('Invalid or missing authorization code.');
            finish({ error: 'TikTok did not return a valid authorization code' });
            return;
          }
          const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_key: clientKey, client_secret: clientSecret, code,
              grant_type: 'authorization_code', redirect_uri: TIKTOK_REDIRECT_URI,
            }),
          });
          const tokenJson = await tokenRes.json().catch(() => ({}));
          if (!tokenRes.ok || !tokenJson.access_token) {
            res.writeHead(400); res.end('Token exchange failed. You can close this window.');
            finish({ error: tokenJson?.error_description || 'TikTok token exchange failed' });
            return;
          }
          getSettings().contentFactory.tiktok = {
            clientKey, clientSecret,
            accessToken: tokenJson.access_token,
            refreshToken: tokenJson.refresh_token,
            expiresAt: Date.now() + (tokenJson.expires_in || 0) * 1000,
            openId: tokenJson.open_id || '',
          };
          saveSettings(getSettings());
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body>TikTok connected — you can close this window and return to Zeus.</body></html>');
          finish({ ok: true, openId: tokenJson.open_id });
        } catch (err) {
          try { res.writeHead(500); res.end('Error'); } catch {}
          finish({ error: err.message });
        }
      });
      tiktokAuthServer.listen(TIKTOK_REDIRECT_PORT, '127.0.0.1', () => {
        const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(clientKey)}` +
          `&scope=${encodeURIComponent('user.info.basic,video.publish')}&response_type=code` +
          `&redirect_uri=${encodeURIComponent(TIKTOK_REDIRECT_URI)}&state=${state}`;
        shell.openExternal(authUrl);
      });
      setTimeout(() => finish({ error: 'Timed out waiting for TikTok authorization (5 min).' }), 300000);
    });
  });

  ipcMain.handle('zeus:tiktok-status', () => {
    const t = getSettings()?.contentFactory?.tiktok || {};
    return { connected: !!t.accessToken, openId: t.openId || '' };
  });

  ipcMain.handle('zeus:tiktok-disconnect', () => {
    getSettings().contentFactory.tiktok = { clientKey: '', clientSecret: '', accessToken: '', refreshToken: '', expiresAt: 0, openId: '' };
    saveSettings(getSettings());
    return { ok: true };
  });

  async function tiktokUploadVideo(videoPath, { caption, privacyLevel }) {
    const t = getSettings()?.contentFactory?.tiktok;
    if (!t?.accessToken) throw new Error('TikTok not connected');
    const stat = fs.statSync(videoPath);
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_info: {
          title: caption || '', privacy_level: privacyLevel || 'SELF_ONLY',
          disable_duet: false, disable_comment: false, disable_stitch: false,
        },
        source_info: { source: 'FILE_UPLOAD', video_size: stat.size, chunk_size: stat.size, total_chunk_count: 1 },
      }),
    });
    const initJson = await initRes.json().catch(() => ({}));
    if (!initRes.ok || !initJson?.data?.upload_url) {
      throw new Error(initJson?.error?.message || `TikTok init failed (${initRes.status})`);
    }
    const { upload_url, publish_id } = initJson.data;
    const buf = fs.readFileSync(videoPath);
    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(stat.size), 'Content-Range': `bytes 0-${stat.size - 1}/${stat.size}` },
      body: buf,
    });
    if (!putRes.ok) throw new Error(`TikTok upload failed (${putRes.status})`);

    const deadline = Date.now() + 120000;
    let status = 'PROCESSING_UPLOAD';
    while (Date.now() < deadline && !['PUBLISH_COMPLETE', 'FAILED'].includes(status)) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_id }),
      });
      const statusJson = await statusRes.json().catch(() => ({}));
      status = statusJson?.data?.status || status;
      if (status === 'FAILED') throw new Error(statusJson?.data?.fail_reason || 'TikTok publish failed');
    }
    return { publishId: publish_id, status };
  }

  ipcMain.handle('zeus:tiktok-schedule', async (_, { videoPath, caption, privacyLevel, scheduledAt }) => {
    if (!fs.existsSync(videoPath)) return { error: 'Video file not found' };
    const job = {
      id: 'job-' + Date.now(), videoPath, caption: caption || '', privacyLevel: privacyLevel || 'SELF_ONLY',
      scheduledAt: scheduledAt || Date.now(), status: 'queued', error: null,
    };
    getSettings().contentFactory.uploadQueue = [...(getSettings().contentFactory.uploadQueue || []), job];
    saveSettings(getSettings());
    return { ok: true, job };
  });

  ipcMain.handle('zeus:tiktok-queue', () => getSettings()?.contentFactory?.uploadQueue || []);

  ipcMain.handle('zeus:tiktok-cancel', (_, id) => {
    getSettings().contentFactory.uploadQueue = (getSettings().contentFactory.uploadQueue || []).filter(j => j.id !== id);
    saveSettings(getSettings());
    return { ok: true };
  });

  // Polls the local queue every 30s and fires whichever scheduled job is due.
  // TikTok's API has no server-side "publish later" param, so scheduling is our own.
  setInterval(async () => {
    const queue = getSettings()?.contentFactory?.uploadQueue || [];
    const due = queue.find(j => j.status === 'queued' && j.scheduledAt <= Date.now());
    if (!due) return;
    due.status = 'uploading';
    saveSettings(getSettings());
    try {
      await tiktokUploadVideo(due.videoPath, { caption: due.caption, privacyLevel: due.privacyLevel });
      due.status = 'done';
    } catch (err) {
      due.status = 'failed';
      due.error = err.message;
    }
    saveSettings(getSettings());
  }, 30000);
}

module.exports = { registerContentFactory };
