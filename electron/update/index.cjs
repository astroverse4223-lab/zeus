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
