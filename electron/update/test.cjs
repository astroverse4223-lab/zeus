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
