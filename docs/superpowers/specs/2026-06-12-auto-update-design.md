# Zeus Auto-Update — Design

**Date:** 2026-06-12
**Status:** Approved (design); pending implementation plan
**Scope:** Feature 2 of 2 (independent of the RAG feature). Built off `main`.

## 1. Goal

Let Zeus tell the user when a newer version is available on GitHub and download it
for them — keeping the existing portable-zip distribution, with no installer and
no code signing.

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mechanism | **Lightweight in-app checker** | Fits the current portable-zip model; no installer/signing overhaul. |
| Update feed | **GitHub Releases API** (`astroverse4223-lab/zeus`) | Public repo, no token needed; user publishes a Release with the zip attached. |
| Update action | **Download in-app → reveal in folder** | Convenient + safe for a portable app; user unzips/replaces. No risky self-overwrite. |
| Download target | **OS Downloads folder** | Familiar and discoverable. |
| Version source | **`app.getVersion()`** + packaging reads `package.json` | Requires fixing the hardcoded version in the packager (see §3.0). |
| Check cadence | **Once on startup + manual button** | No background polling (YAGNI). |
| Platform | **Windows only** | Matches current distribution. |

## 3. Architecture

A self-contained `electron/update/` module, wired through the existing
tool-registry-style IPC → preload → renderer patterns (mirrors `electron/knowledge/`).

```
Renderer (Settings → Updates)        Main process (electron/update/)
  current version, Check button  ──IPC──▶  index.cjs
  "vX available" + notes                    ├── compareVersions(a,b)   (pure)
  Download (progress) → Reveal              ├── pickAsset(assets)      (pure)
                                            ├── checkForUpdate(opts)   (GitHub HTTP)
  Startup auto-check ──▶ OS notification     └── downloadUpdate(url,dir,onProgress)
```

### 3.0 Prerequisite: real version in the build

`scripts/package-app.cjs` currently hardcodes `appVersion: '1.0.0'`. Change it to
read the version from `package.json` so `app.getVersion()` reflects the shipped
version. Without this, the checker can never detect that a release is newer.

```js
const pkg = require('../package.json');
// ...
appVersion: pkg.version,
```

### 3.1 Module units (`electron/update/index.cjs`)

- **`compareVersions(a, b) → -1 | 0 | 1`** — strips a leading `v`, compares
  dot-separated numeric parts (missing parts treated as 0). Pure.
- **`pickAsset(assets) → asset | null`** — from a release's `assets[]`, returns
  the first whose `name` ends in `.zip` (prefers one matching `win`). Pure.
- **`checkForUpdate({ repo, currentVersion, host?, port? })`** →
  `{ current, latest, newer, notes, downloadUrl, assetName }`.
  GETs `https://api.github.com/repos/<repo>/releases/latest` with a
  `User-Agent: zeus-ai` header (GitHub requires it). `host`/`port` are injectable
  so tests can point at a local mock server. Maps failures to typed results
  (see §5). `newer = compareVersions(latest, current) > 0`.
- **`downloadUpdate(url, destDir, onProgress) → filePath`** — streams the asset
  (following redirects to `objects.githubusercontent.com`) to
  `destDir/<assetName>`, emitting `{ received, total }` progress. Returns the
  saved path.

### 3.2 IPC + preload surface (`main.cjs`, `preload.cjs`)

| Channel | Type | Purpose |
|---------|------|---------|
| `zeus:update-check` | invoke | Returns the `checkForUpdate` result (uses `app.getVersion()`) |
| `zeus:update-download` | invoke `(url)` | Downloads to Downloads folder; streams `zeus:update-progress`; returns path |
| `zeus:update-progress` | event | `{ received, total }` |
| `zeus:reveal-file` | invoke `(path)` | `shell.showItemInFolder(path)` |

preload exposes: `updateCheck()`, `updateDownload(url)`, `onUpdateProgress(cb)`,
`revealFile(path)`, plus `appVersion()` (→ `app.getVersion()` via a small handler).

Repo (`astroverse4223-lab/zeus`) is a constant in the update module.

### 3.3 Startup auto-check (`main.cjs`)

A few seconds after the window is ready, the main process runs
`checkForUpdate` once. If `newer`, it shows a native `Notification`
("Zeus vX.Y.Z is available") — non-intrusive, no modal. Failures are logged and
swallowed (never bother the user on a flaky network).

## 4. UI — Settings "Updates" section

A new section in Settings (new `UpdatePanel.jsx`, mounted like `KnowledgePanel`):

- **Current version** row (`v1.0.0`).
- **Check for updates** button → calls `updateCheck()`, shows a spinner.
- Result states:
  - *Up to date* — "You're on the latest version."
  - *Update available* — `vX.Y.Z available`, release notes (collapsed/scrollable),
    and a **Download** button.
- During download: a **progress bar** (`received/total`).
- After download: **Reveal in folder** button → `revealFile(path)` + a hint to
  unzip and replace the app folder.
- Error state: a clear message (see §5).

## 5. Error handling

`checkForUpdate` and `downloadUpdate` never throw to the UI; they return/raise
typed outcomes surfaced as friendly strings:

- **No network / DNS fail** → "Couldn't reach GitHub. Check your connection."
- **Rate limited (HTTP 403, 60/hr unauthenticated)** → "GitHub rate limit reached, try again later."
- **No releases yet (HTTP 404)** → "No releases published yet."
- **Release has no `.zip` asset** → "Latest release has no downloadable build."
- **Download interrupted** → "Download failed — try again." (partial file removed)
- **Startup check** → all failures logged only, UI unaffected.

## 6. Testing strategy

Pure units + the HTTP boundary mocked with a local server (same pattern as the
knowledge embedder). Plain-assert runner `electron/update/test.cjs`; `npm test`
runs both the knowledge and update runners.

- `compareVersions` — ordering, `v` prefix, unequal lengths, equal versions.
- `pickAsset` — picks `.zip`, prefers `win`, returns null when none.
- `checkForUpdate` — against a mock server: newer / same / 404 / 403 / missing-asset.
- `downloadUpdate` — streams bytes from a mock server to a temp dir, reports
  progress, returns the path.

## 7. Out of scope (v1 / future)

- electron-updater / NSIS installer / silent background install.
- Auto-extract and relaunch over the running `.exe`.
- Delta updates, release channels (beta/stable), rollback.
- macOS / Linux update flows.
- Background polling beyond the single startup check.

## 8. New dependencies

None — uses Node's built-in `https`/`http` and Electron `shell`/`Notification`.

## 9. Affected existing files

- `scripts/package-app.cjs` — stamp version from `package.json` (§3.0).
- `electron/main.cjs` — update IPC handlers, `reveal-file`, startup check.
- `electron/preload.cjs` — expose `update*` / `revealFile` / `appVersion`.
- `src/components/UpdatePanel.jsx` (new) + mount in `src/components/Settings.jsx`.
- `package.json` — `test` script runs the update runner too.
