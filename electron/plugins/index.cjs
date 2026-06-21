'use strict';

// ─── Zeus Plugins (Tier 1: skill packs) ───────────────────────────────────────
// A Zeus plugin is a GitHub repo containing markdown "skill" files and an optional
// `zeus-plugin.json` manifest. Installing fetches those .md files (no code is ever
// executed) and stores them under userData/plugins/<slug>/. When a plugin is enabled,
// its skill text is appended to the agent (and/or chat) system prompt — exactly how
// caveman/superpowers shape model behavior. Dependency-free: uses the GitHub API +
// raw.githubusercontent over plain https, no zip/unzip needed.

const fs = require('fs');
const path = require('path');

const MAX_SKILL_FILES = 60;        // cap files pulled from one repo
const MAX_SKILL_BYTES = 256 * 1024; // per-file cap
const MAX_PROMPT_BYTES = 120 * 1024; // total injected into a system prompt

// ─── Pure helpers (no network / fs) ────────────────────────────────────────────

/** Parse a GitHub repo reference into parts. Accepts:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/<branch>/<subdir...>
 *   owner/repo
 */
function parseRepoUrl(input) {
  if (!input || typeof input !== 'string') throw new Error('No repo URL');
  let s = input.trim().replace(/\.git$/i, '');
  s = s.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
  const parts = s.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Expected owner/repo or a github.com URL');
  const [owner, repo] = parts;
  let branch = null;
  let subdir = '';
  if (parts[2] === 'tree' && parts[3]) {
    branch = parts[3];
    subdir = parts.slice(4).join('/');
  }
  return { owner, repo, branch, subdir };
}

/** Filesystem-safe slug for a plugin folder name. */
function slugify(name) {
  return String(name || 'plugin')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'plugin';
}

/** A skill manifest may list explicit files or globs (`*`, `**`). Decide if a repo
 *  path (relative to skillsDir) should be pulled in as a skill. */
function pathMatchesSkills(relPath, skillsPatterns) {
  if (!Array.isArray(skillsPatterns) || skillsPatterns.length === 0) {
    return /\.md$/i.test(relPath) && !/^readme\.md$/i.test(path.basename(relPath));
  }
  return skillsPatterns.some((pat) => {
    if (!pat.includes('*')) return relPath === pat || path.basename(relPath) === pat;
    const re = new RegExp('^' + pat
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, ' ')
      .replace(/\*/g, '[^/]*')
      .replace(/ /g, '.*') + '$', 'i');
    return re.test(relPath);
  });
}

/** True if a plugin declared for `pluginMode` should apply in the current `mode`. */
function modeApplies(pluginMode, mode) {
  const m = (pluginMode || 'both').toLowerCase();
  return m === 'both' || m === mode;
}

// ─── Network (injectable for tests) ─────────────────────────────────────────────

function httpGet(host, reqPath, { json = false } = {}) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.request({
      host, path: reqPath, method: 'GET',
      headers: { 'User-Agent': 'zeus-ai', Accept: json ? 'application/vnd.github+json' : '*/*' },
    }, (res) => {
      // raw.githubusercontent + API both may redirect; follow once.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = new URL(res.headers.location);
        return resolve(httpGet(loc.host, loc.pathname + loc.search, { json }));
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function defaultFetchJson(p) {
  const r = await httpGet('api.github.com', p, { json: true });
  if (r.status !== 200) throw new Error(`GitHub ${r.status} for ${p}`);
  return JSON.parse(r.body);
}

async function defaultFetchRaw(owner, repo, branch, filePath) {
  const r = await httpGet('raw.githubusercontent.com', `/${owner}/${repo}/${branch}/${filePath}`);
  if (r.status !== 200) throw new Error(`raw ${r.status} for ${filePath}`);
  return r.body;
}

// ─── Install / list / remove ────────────────────────────────────────────────────

/**
 * Install a plugin from a GitHub repo into baseDir/<slug>/.
 * @param {{baseDir:string,url:string,fetchJson?:Function,fetchRaw?:Function}} opts
 */
async function installPlugin({ baseDir, url, fetchJson = defaultFetchJson, fetchRaw = defaultFetchRaw }) {
  const { owner, repo, branch: wantBranch, subdir } = parseRepoUrl(url);

  let branch = wantBranch;
  if (!branch) {
    const meta = await fetchJson(`/repos/${owner}/${repo}`);
    branch = meta.default_branch || 'main';
  }

  const tree = await fetchJson(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  const blobs = (tree.tree || []).filter((t) => t.type === 'blob').map((t) => t.path);

  const skillsDir = subdir ? subdir.replace(/\/+$/, '') + '/' : '';
  const rel = (p) => (skillsDir && p.startsWith(skillsDir)) ? p.slice(skillsDir.length) : p;

  // Optional manifest at the (sub)dir root.
  let manifest = {};
  const manifestPath = skillsDir + 'zeus-plugin.json';
  if (blobs.includes(manifestPath)) {
    try { manifest = JSON.parse(await fetchRaw(owner, repo, branch, manifestPath)); } catch {}
  }

  // Choose skill files.
  const candidates = blobs
    .filter((p) => (skillsDir ? p.startsWith(skillsDir) : true))
    .filter((p) => !/(^|\/)(node_modules|\.git|dist|build)\//.test(p))
    .filter((p) => pathMatchesSkills(rel(p), manifest.skills));

  if (candidates.length === 0) {
    throw new Error('No skill (.md) files found in this repo.');
  }

  const name = manifest.name || repo;
  const slug = slugify(name);
  const dir = path.join(baseDir, slug);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });

  const skillFiles = [];
  for (const p of candidates.slice(0, MAX_SKILL_FILES)) {
    let content;
    try { content = await fetchRaw(owner, repo, branch, p); } catch { continue; }
    if (Buffer.byteLength(content) > MAX_SKILL_BYTES) content = content.slice(0, MAX_SKILL_BYTES);
    const safeRel = rel(p).replace(/[^a-zA-Z0-9._/-]/g, '_');
    const outPath = path.join(dir, 'skills', safeRel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content, 'utf8');
    skillFiles.push(safeRel);
  }
  if (skillFiles.length === 0) throw new Error('Failed to download any skill files.');

  const meta = {
    name,
    slug,
    repo: `${owner}/${repo}`,
    branch,
    version: manifest.version || '',
    description: manifest.description || '',
    mode: (manifest.mode || 'both').toLowerCase(),
    skills: skillFiles,
    installedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

/** List installed plugins (reads each plugin.json under baseDir). */
function listPlugins(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(baseDir, entry.name, 'plugin.json');
    try { out.push(JSON.parse(fs.readFileSync(metaPath, 'utf8'))); } catch {}
  }
  return out;
}

/** Remove an installed plugin by slug. */
function removePlugin(baseDir, slug) {
  const dir = path.join(baseDir, slugify(slug));
  fs.rmSync(dir, { recursive: true, force: true });
  return { removed: true };
}

/**
 * Concatenate the skill text of enabled plugins that apply to `mode` ('agent'|'chat').
 * Returns '' when nothing applies. Result is capped to `maxBytes` (default MAX_PROMPT_BYTES) —
 * callers running a local model pass a much smaller budget, since a 120KB system prompt that's
 * cheap for a cloud API to reprocess is a brutal prefill cost on consumer GPU/CPU hardware.
 */
function loadEnabledSkills(baseDir, enabledSlugs, mode, maxBytes = MAX_PROMPT_BYTES) {
  if (!Array.isArray(enabledSlugs) || enabledSlugs.length === 0) return '';
  const enabled = new Set(enabledSlugs.map(slugify));
  let out = '';
  for (const meta of listPlugins(baseDir)) {
    if (!enabled.has(meta.slug)) continue;
    if (!modeApplies(meta.mode, mode)) continue;
    let body = '';
    for (const rel of meta.skills || []) {
      try { body += '\n\n' + fs.readFileSync(path.join(baseDir, meta.slug, 'skills', rel), 'utf8'); } catch {}
    }
    if (!body.trim()) continue;
    out += `\n\n# Plugin: ${meta.name}\n${body.trim()}`;
    if (Buffer.byteLength(out) > maxBytes) { out = out.slice(0, maxBytes); break; }
  }
  return out.trim();
}

module.exports = {
  parseRepoUrl, slugify, pathMatchesSkills, modeApplies,
  installPlugin, listPlugins, removePlugin, loadEnabledSkills,
};
