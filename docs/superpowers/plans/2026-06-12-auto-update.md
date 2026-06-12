# Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app, GitHub-Releases-based update checker that tells the user when a newer Zeus is available and downloads it to their Downloads folder.

**Architecture:** A self-contained `electron/update/` module (pure version-compare + asset-pick, plus a GitHub HTTP boundary) wired through IPC → preload → a Settings "Updates" panel, mirroring the `electron/knowledge/` layout. No installer, no signing.

**Tech Stack:** Electron 32 (CommonJS main), Node built-in `https`/`http`, plain-assert test runner (no new deps).

**Spec:** `docs/superpowers/specs/2026-06-12-auto-update-design.md`

---

## File Structure

**New (main process):**
- `electron/update/index.cjs` — `compareVersions`, `pickAsset`, `checkForUpdate`, `downloadUpdate`
- `electron/update/test.cjs` — plain-assert test runner

**New (renderer):**
- `src/components/UpdatePanel.jsx` — version, check, download progress, reveal

**Modified:**
- `scripts/package-app.cjs` — stamp version from `package.json`
- `electron/main.cjs` — update IPC handlers, `reveal-file`, startup check
- `electron/preload.cjs` — expose `update*` / `revealFile` / `appVersion`
- `src/components/Settings.jsx` — mount `UpdatePanel`
- `package.json` — `test` script runs the update runner

> Note: this branch (`feature/auto-update`) is off `main`, so it does **not**
> contain `electron/knowledge/`. The `test` script here runs only the update
> runner; when this branch and the RAG branch both merge, combine the two test
> commands (`node electron/knowledge/test.cjs && node electron/update/test.cjs`).

---

## Task 1: update module — pure helpers + GitHub check (TDD)

**Files:**
- Create: `electron/update/index.cjs`
- Create: `electron/update/test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Add the test script**

In `package.json` `"scripts"`, add:

```json
    "test": "node electron/update/test.cjs"
```

- [ ] **Step 2: Write the failing test runner**

`electron/update/test.cjs`:

```js
'use strict';
// Plain-assert runner (node:test hangs in some sandboxed shells; this runs in-process).
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { compareVersions, pickAsset, checkForUpdate, downloadUpdate } = require('./index.cjs');

let passed = 0; const failures = [];
async function t(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`FAIL  ${name}\n      ${e && e.message}`); }
}
function server(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ port: s.address().port, close: () => s.close() }));
  });
}

(async () => {
  await t('compareVersions orders numerically and strips v', () => {
    assert.strictEqual(compareVersions('1.2.0', '1.1.9'), 1);
    assert.strictEqual(compareVersions('v1.0.0', '1.0.0'), 0);
    assert.strictEqual(compareVersions('1.0', '1.0.1'), -1);
    assert.strictEqual(compareVersions('2.0.0', 'v1.9.9'), 1);
  });

  await t('pickAsset prefers a win .zip, else first .zip, else null', () => {
    assert.strictEqual(pickAsset([{ name: 'notes.txt' }]), null);
    assert.strictEqual(pickAsset([{ name: 'Zeus-mac.zip' }, { name: 'Zeus-win-x64.zip' }]).name, 'Zeus-win-x64.zip');
    assert.strictEqual(pickAsset([{ name: 'build.zip' }]).name, 'build.zip');
    assert.strictEqual(pickAsset(null), null);
  });

  await t('checkForUpdate flags a newer release with its zip asset', async () => {
    const srv = await server((req, res) => res.end(JSON.stringify({
      tag_name: 'v1.2.0', body: 'notes',
      assets: [{ name: 'Zeus-win-x64.zip', browser_download_url: 'http://x/Zeus-win-x64.zip' }],
    })));
    const r = await checkForUpdate({ currentVersion: '1.0.0', host: '127.0.0.1', port: srv.port, protocol: 'http' });
    srv.close();
    assert.strictEqual(r.newer, true);
    assert.strictEqual(r.latest, '1.2.0');
    assert.strictEqual(r.assetName, 'Zeus-win-x64.zip');
    assert.strictEqual(r.notes, 'notes');
  });

  await t('checkForUpdate: same version is not newer', async () => {
    const srv = await server((req, res) => res.end(JSON.stringify({ tag_name: 'v1.0.0', assets: [] })));
    const r = await checkForUpdate({ currentVersion: '1.0.0', host: '127.0.0.1', port: srv.port, protocol: 'http' });
    srv.close();
    assert.strictEqual(r.newer, false);
  });

  await t('checkForUpdate maps 404 to NO_RELEASES', async () => {
    const srv = await server((req, res) => { res.statusCode = 404; res.end('{}'); });
    const r = await checkForUpdate({ currentVersion: '1.0.0', host: '127.0.0.1', port: srv.port, protocol: 'http' });
    srv.close();
    assert.strictEqual(r.error, 'NO_RELEASES');
  });

  await t('checkForUpdate maps 403 to RATE_LIMIT', async () => {
    const srv = await server((req, res) => { res.statusCode = 403; res.end('{}'); });
    const r = await checkForUpdate({ currentVersion: '1.0.0', host: '127.0.0.1', port: srv.port, protocol: 'http' });
    srv.close();
    assert.strictEqual(r.error, 'RATE_LIMIT');
  });

  await t('checkForUpdate flags noAsset when release has no zip', async () => {
    const srv = await server((req, res) => res.end(JSON.stringify({ tag_name: 'v2.0.0', assets: [{ name: 'notes.txt' }] })));
    const r = await checkForUpdate({ currentVersion: '1.0.0', host: '127.0.0.1', port: srv.port, protocol: 'http' });
    srv.close();
    assert.strictEqual(r.noAsset, true);
    assert.strictEqual(r.downloadUrl, null);
  });

  await t('downloadUpdate streams to a file and reports progress', async () => {
    const body = Buffer.from('PK zeus zip payload');
    const srv = await server((req, res) => {
      res.setHeader('Content-Length', String(body.length));
      res.end(body);
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-upd-'));
    const seen = [];
    const file = await downloadUpdate(`http://127.0.0.1:${srv.port}/Zeus-win-x64.zip`, dir, (p) => seen.push(p));
    srv.close();
    assert.ok(file.endsWith('Zeus-win-x64.zip'));
    assert.strictEqual(fs.readFileSync(file).length, body.length);
    assert.ok(seen.length > 0 && seen[seen.length - 1].received === body.length);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node electron/update/test.cjs`
Expected: FAIL — "Cannot find module './index.cjs'".

- [ ] **Step 4: Implement the module**

`electron/update/index.cjs`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = 'astroverse4223-lab/zeus';

/** Compare dot-separated numeric versions (leading `v` ignored). -> -1 | 0 | 1 */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** Pick a downloadable .zip asset, preferring one whose name mentions "win". */
function pickAsset(assets) {
  if (!Array.isArray(assets)) return null;
  const zips = assets.filter((a) => /\.zip$/i.test((a && a.name) || ''));
  if (!zips.length) return null;
  return zips.find((a) => /win/i.test(a.name)) || zips[0];
}

function request(protocol, options) {
  return new Promise((resolve, reject) => {
    const lib = protocol === 'http' ? require('node:http') : require('node:https');
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * @param {{repo?:string,currentVersion:string,host?:string,port?:number,protocol?:'http'|'https'}} opts
 * @returns {Promise<object>} { current, latest, newer, notes, downloadUrl, assetName, noAsset } | { error, message, current }
 */
async function checkForUpdate(opts = {}) {
  const {
    repo = REPO, currentVersion,
    host = 'api.github.com', port = 443, protocol = 'https',
  } = opts;
  let res;
  try {
    res = await request(protocol, {
      host, port, path: `/repos/${repo}/releases/latest`, method: 'GET',
      headers: { 'User-Agent': 'zeus-ai', Accept: 'application/vnd.github+json' },
    });
  } catch {
    return { error: 'NETWORK', message: "Couldn't reach GitHub. Check your connection.", current: currentVersion };
  }
  if (res.status === 404) return { error: 'NO_RELEASES', message: 'No releases published yet.', current: currentVersion };
  if (res.status === 403) return { error: 'RATE_LIMIT', message: 'GitHub rate limit reached, try again later.', current: currentVersion };
  if (res.status !== 200) return { error: 'HTTP', message: `GitHub returned ${res.status}.`, current: currentVersion };

  let json;
  try { json = JSON.parse(res.body); }
  catch { return { error: 'BAD_RESPONSE', message: 'Unexpected response from GitHub.', current: currentVersion }; }

  const latest = String(json.tag_name || json.name || '').replace(/^v/i, '');
  const asset = pickAsset(json.assets);
  return {
    current: currentVersion,
    latest,
    newer: !!latest && compareVersions(latest, currentVersion) > 0,
    notes: json.body || '',
    downloadUrl: asset ? asset.browser_download_url : null,
    assetName: asset ? asset.name : null,
    noAsset: !asset,
  };
}

/** Stream a release asset to destDir (following redirects), reporting progress. */
function downloadUpdate(url, destDir, onProgress) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    const fileName = decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || 'zeus-update.zip';
    const dest = path.join(destDir, fileName);

    const get = (u, redirects) => {
      const parsed = new URL(u);
      const lib = parsed.protocol === 'http:' ? require('node:http') : require('node:https');
      const req = lib.get({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'zeus-ai' },
      }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
          res.resume();
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(Object.assign(new Error(`HTTP ${res.statusCode}`), { code: 'HTTP' }));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const out = fs.createWriteStream(dest);
        res.on('data', (chunk) => { received += chunk.length; if (onProgress) onProgress({ received, total }); });
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve(dest)));
        out.on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
      });
      req.on('error', reject);
    };

    get(url, 0);
  });
}

module.exports = { compareVersions, pickAsset, checkForUpdate, downloadUpdate, REPO };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node electron/update/test.cjs`
Expected: PASS — `8 passed, 0 failed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add electron/update/index.cjs electron/update/test.cjs package.json
git commit -m "feat(update): add GitHub-releases update module (compare, check, download)"
```

---

## Task 2: packaging version fix

**Files:**
- Modify: `scripts/package-app.cjs`

- [ ] **Step 1: Read version from package.json**

In `scripts/package-app.cjs`, add near the top requires:

```js
const pkg = require('../package.json');
```

Then change the hardcoded `appVersion: '1.0.0',` line to:

```js
    appVersion:   pkg.version,
```

- [ ] **Step 2: Verify the script still parses**

Run: `node --check scripts/package-app.cjs`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/package-app.cjs
git commit -m "fix(build): stamp app version from package.json"
```

---

## Task 3: Wire into main.cjs (IPC + startup check)

**Files:**
- Modify: `electron/main.cjs`

No automated test (Electron main process); verified via build + manual check in Task 6.

- [ ] **Step 1: Require the update module**

Near the other top-of-file requires in `electron/main.cjs` (after the `SETTINGS_FILE` line ~18), add:

```js
const updater = require('./update/index.cjs');
```

- [ ] **Step 2: Ensure `shell` and `Notification` are imported from electron**

Find the `require('electron')` destructure near the top of `electron/main.cjs`. Make sure it includes `shell` and `Notification`. If they are missing, add them, e.g.:

```js
const { app, BrowserWindow, ipcMain, dialog, shell, Notification, /* ...existing... */ } = require('electron');
```

(Keep all existing names; only add the missing ones.)

- [ ] **Step 3: Add update IPC handlers**

After the `zeus:pick-directory` handler (~line 287), add:

```js
// ─── Auto-Update IPC ──────────────────────────────────────────────────────────
ipcMain.handle('zeus:app-version', () => app.getVersion());

ipcMain.handle('zeus:update-check', () => updater.checkForUpdate({ currentVersion: app.getVersion() }));

ipcMain.handle('zeus:update-download', async (e, url) => {
  if (!url) return { error: 'No download URL.' };
  const wc = e.sender;
  try {
    const file = await updater.downloadUpdate(url, app.getPath('downloads'), (p) => {
      if (!wc.isDestroyed()) wc.send('zeus:update-progress', p);
    });
    return { file };
  } catch (err) {
    return { error: 'Download failed — try again.' };
  }
});

ipcMain.handle('zeus:reveal-file', (_, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
  return true;
});
```

- [ ] **Step 4: Add the startup check**

Find where the main window is created and shown (search for `new BrowserWindow(` / `mainWindow = `). After the window is created and `mainWindow` is assigned, add a one-time deferred check. A safe place is at the end of the `createWindow` function (or right after `mainWindow.loadURL`/`loadFile`). Add:

```js
  // One-time update check a few seconds after launch (non-intrusive).
  setTimeout(async () => {
    try {
      const r = await updater.checkForUpdate({ currentVersion: app.getVersion() });
      if (r && r.newer && Notification.isSupported()) {
        new Notification({
          title: '⚡ Zeus update available',
          body: `Version ${r.latest} is available. Open Settings → Updates to download.`,
        }).show();
      }
    } catch { /* ignore — never bother the user on a flaky network */ }
  }, 5000);
```

- [ ] **Step 5: Verify main.cjs parses and the module loads**

Run: `node --check electron/main.cjs && node -e "require('./electron/update/index.cjs'); console.log('update module OK')"`
Expected: `update module OK`.

- [ ] **Step 6: Commit**

```bash
git add electron/main.cjs
git commit -m "feat(update): add update IPC handlers and startup check"
```

---

## Task 4: Expose update API in preload

**Files:**
- Modify: `electron/preload.cjs`

- [ ] **Step 1: Add the bridge**

In `electron/preload.cjs`, inside the `contextBridge.exposeInMainWorld('zeus', { ... })` object, before the closing `});`, add:

```js
  // Auto-update
  appVersion:     ()    => ipcRenderer.invoke('zeus:app-version'),
  updateCheck:    ()    => ipcRenderer.invoke('zeus:update-check'),
  updateDownload: (url) => ipcRenderer.invoke('zeus:update-download', url),
  revealFile:     (p)   => ipcRenderer.invoke('zeus:reveal-file', p),
  onUpdateProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('zeus:update-progress', handler);
    return () => ipcRenderer.removeListener('zeus:update-progress', handler);
  },
```

- [ ] **Step 2: Verify preload parses**

Run: `node --check electron/preload.cjs`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add electron/preload.cjs
git commit -m "feat(update): expose update API on window.zeus"
```

---

## Task 5: Updates panel UI

**Files:**
- Create: `src/components/UpdatePanel.jsx`
- Modify: `src/components/Settings.jsx`

- [ ] **Step 1: Create the panel**

`src/components/UpdatePanel.jsx`:

```jsx
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
```

- [ ] **Step 2: Mount it in Settings**

In `src/components/Settings.jsx`, add the import with the others:

```jsx
import UpdatePanel from './UpdatePanel.jsx';
```

Then render it as a new section. Place it immediately after the `Compact HUD` ToggleRow in the appearance section, wrapped with a separator:

```jsx
        <div style={{ marginTop: 18, borderTop: '1px solid var(--c-border)', paddingTop: 18 }}>
          <UpdatePanel />
        </div>
```

- [ ] **Step 3: Build to verify the renderer compiles**

Run: `npm run build`
Expected: Vite build succeeds with no JSX errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/UpdatePanel.jsx src/components/Settings.jsx
git commit -m "feat(update): add Updates panel in Settings"
```

---

## Task 6: Verify + docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the update unit suite**

Run: `node electron/update/test.cjs`
Expected: `8 passed, 0 failed`.

- [ ] **Step 2: Build the whole app**

Run: `npm run build`
Expected: Vite build succeeds.

- [ ] **Step 3: Manual smoke (optional, needs network)**

Run: `npm run dev`, open Settings → Updates. Click **Check for updates**.
Expected: with no GitHub release published yet, it shows "No releases published yet."
(Once a Release with a `Zeus-*.zip` asset and a higher `package.json` version exists, it shows "vX available" + Download.)

- [ ] **Step 4: Document in README**

In `README.md`, add a feature entry near the other sections:

```markdown
### ⬆️ Auto-Update

Zeus checks GitHub for new releases on startup and from **Settings → Updates**.
When a newer version is published, it can download the build straight to your
Downloads folder and reveal it for you to unzip and replace. No installer needed.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document auto-update feature"
```

---

## Self-Review Notes

- **Spec coverage:** §3.0 packager fix -> Task 2; §3.1 module units -> Task 1; §3.2 IPC/preload -> Tasks 3-4; §3.3 startup check -> Task 3 Step 4; §4 UI -> Task 5; §5 error handling -> typed results in Task 1 surfaced in Task 5; §6 testing -> Task 1 runner (8 tests).
- **Type consistency:** `checkForUpdate(opts)` result shape `{ current, latest, newer, notes, downloadUrl, assetName, noAsset }` (or `{ error, message, current }`) is consumed identically by `main.cjs` and `UpdatePanel.jsx`; `downloadUpdate(url, destDir, onProgress)` and the `{ received, total }` progress shape match across module, IPC, and UI.
- **No placeholders:** every code step is complete and runnable.
```
