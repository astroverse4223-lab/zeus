'use strict';

/*
 * Plain-assert test runner for the knowledge module.
 *
 * Why not `node --test`? The built-in node:test runner spawns child worker
 * processes for test isolation, which hangs in some sandboxed/wrapped shells.
 * This runner uses only node:assert + a tiny harness so it runs in-process and
 * always terminates. Mirrors the behaviors documented in the *.test.cjs files.
 *
 * Run: npm test   (→ node electron/knowledge/test.cjs)
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const { chunk } = require('./chunker.cjs');
const { createStore } = require('./store.cjs');
const { extractText, expandPaths, classify } = require('./extractors.cjs');
const { embed } = require('./embedder.cjs');
const { createIndex } = require('./index.cjs');

let passed = 0;
const failures = [];

async function t(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push({ name, e });
    console.log(`FAIL  ${name}\n      ${e && e.message}`);
  }
}

function tmpDir(p) { return fs.mkdtempSync(path.join(os.tmpdir(), p)); }
function vec(arr, dim) {
  const v = new Float32Array(dim);
  for (let i = 0; i < arr.length; i++) v[i] = arr[i];
  return v;
}
function server(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ port: s.address().port, close: () => s.close() }));
  });
}

(async () => {
  // ── chunker ────────────────────────────────────────────────────────────────
  await t('chunker: empty/whitespace yields no chunks', () => {
    assert.deepStrictEqual(chunk(''), []);
    assert.deepStrictEqual(chunk('   \n  '), []);
    assert.deepStrictEqual(chunk(null), []);
  });
  await t('chunker: short text -> single chunk pos 0', () => {
    const out = chunk('hello world');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].text, 'hello world');
    assert.strictEqual(out[0].pos, 0);
  });
  await t('chunker: long text -> multiple ordered chunks <= size', () => {
    const out = chunk('a'.repeat(2000), { size: 800, overlap: 150 });
    assert.ok(out.length >= 3);
    out.forEach((c, i) => { assert.strictEqual(c.pos, i); assert.ok(c.text.length <= 800); });
  });
  await t('chunker: no infinite loop when overlap >= size', () => {
    const out = chunk('a'.repeat(500), { size: 100, overlap: 100 });
    assert.ok(out.length > 0 && out.length < 1000);
  });

  // ── store ──────────────────────────────────────────────────────────────────
  await t('store: add/persist/reload/search round-trip', () => {
    const dim = 4, dir = tmpDir('kb-store-');
    const s = createStore(dir, { dim });
    s.load();
    s.addChunks(
      { id: 'src1', path: '/a.txt', name: 'a.txt', type: 'text', addedAt: 'now' },
      [{ text: 'apple', pos: 0 }, { text: 'banana', pos: 1 }],
      [vec([1, 0, 0, 0], dim), vec([0, 1, 0, 0], dim)]
    );
    const s2 = createStore(dir, { dim });
    s2.load();
    const hits = s2.search(vec([1, 0, 0, 0], dim), 1);
    assert.strictEqual(hits[0].text, 'apple');
    assert.strictEqual(hits[0].sourceName, 'a.txt');
    assert.ok(hits[0].score > 0.99);
  });
  await t('store: removeSource compacts vectors, search stays correct', () => {
    const dim = 4;
    const s = createStore(tmpDir('kb-store-'), { dim });
    s.load();
    s.addChunks({ id: 'A', path: '/a', name: 'A', type: 'text', addedAt: 'now' },
      [{ text: 'a', pos: 0 }], [vec([1, 0, 0, 0], dim)]);
    s.addChunks({ id: 'B', path: '/b', name: 'B', type: 'text', addedAt: 'now' },
      [{ text: 'b', pos: 0 }], [vec([0, 1, 0, 0], dim)]);
    s.removeSource('A');
    assert.strictEqual(s.stats().sourceCount, 1);
    assert.strictEqual(s.stats().chunkCount, 1);
    assert.strictEqual(s.search(vec([0, 1, 0, 0], dim), 1)[0].text, 'b');
  });
  await t('store: corrupt index loads as empty', () => {
    const dir = tmpDir('kb-store-');
    fs.writeFileSync(path.join(dir, 'index.json'), '{not json');
    const s = createStore(dir, { dim: 4 });
    assert.doesNotThrow(() => s.load());
    assert.strictEqual(s.stats().chunkCount, 0);
  });

  // ── extractors ───────────────────────────────────────────────────────────────
  await t('extractors: reads UTF-8 text/code', async () => {
    const f = path.join(tmpDir('kb-ext-'), 'note.md');
    fs.writeFileSync(f, '# Title\nbody');
    assert.strictEqual(await extractText(f), '# Title\nbody');
  });
  await t('extractors: rejects unsupported binary', async () => {
    const f = path.join(tmpDir('kb-ext-'), 'pic.png');
    fs.writeFileSync(f, Buffer.from([0x89, 0x50]));
    await assert.rejects(() => extractText(f), (e) => e.code === 'UNSUPPORTED');
  });
  await t('extractors: expandPaths recurses, skips node_modules/binaries', () => {
    const dir = tmpDir('kb-ext-');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'b.txt'), 'y');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'c.md'), 'z');
    fs.writeFileSync(path.join(dir, 'img.png'), 'binary');
    assert.deepStrictEqual(expandPaths([dir]).map((f) => path.basename(f)).sort(), ['a.txt', 'c.md']);
  });
  await t('extractors: classify pdf vs text', () => {
    assert.strictEqual(classify('/x/y.pdf'), 'pdf');
    assert.strictEqual(classify('/x/y.md'), 'text');
  });

  // ── embedder ─────────────────────────────────────────────────────────────────
  await t('embedder: returns Float32Array vectors + progress', async () => {
    const srv = await server((req, res) => res.end(JSON.stringify({ embedding: [0.1, 0.2, 0.3] })));
    const seen = [];
    const out = await embed(['hello', 'world'], { host: '127.0.0.1', port: srv.port, onProgress: (d, n) => seen.push([d, n]) });
    srv.close();
    assert.strictEqual(out.length, 2);
    assert.ok(out[0] instanceof Float32Array);
    assert.deepStrictEqual([...out[0]], [Math.fround(0.1), Math.fround(0.2), Math.fround(0.3)]);
    assert.deepStrictEqual(seen, [[1, 2], [2, 2]]);
  });
  await t('embedder: maps missing model -> MODEL_MISSING', async () => {
    const srv = await server((req, res) => res.end(JSON.stringify({ error: 'model "nomic-embed-text" not found, try pulling it first' })));
    await assert.rejects(() => embed(['x'], { host: '127.0.0.1', port: srv.port }), (e) => e.code === 'MODEL_MISSING');
    srv.close();
  });
  await t('embedder: maps connection refused -> OLLAMA_DOWN', async () => {
    await assert.rejects(() => embed(['x'], { host: '127.0.0.1', port: 1 }), (e) => e.code === 'OLLAMA_DOWN');
  });

  // ── index orchestrator ───────────────────────────────────────────────────────
  const fakeEmbed = async (texts) => texts.map((x) => {
    const v = new Float32Array(4);
    if (x.includes('apple')) v[0] = 1; else if (x.includes('banana')) v[1] = 1; else v[2] = 1;
    return v;
  });
  await t('index: ingest folder + search retrieves right source', async () => {
    const work = tmpDir('kb-idx-');
    fs.writeFileSync(path.join(work, 'fruit.txt'), 'apple apple apple');
    fs.writeFileSync(path.join(work, 'other.md'), 'banana banana');
    const idx = createIndex({ baseDir: tmpDir('kb-idx-'), embedFn: fakeEmbed, dim: 4 });
    assert.strictEqual((await idx.ingest([work])).added.length, 2);
    const hits = await idx.search('apple', 1);
    assert.strictEqual(hits[0].sourceName, 'fruit.txt');
  });
  await t('index: ingest skips unsupported files', async () => {
    const work = tmpDir('kb-idx-');
    fs.writeFileSync(path.join(work, 'keep.txt'), 'apple');
    fs.writeFileSync(path.join(work, 'skip.png'), Buffer.from([0x89]));
    const idx = createIndex({ baseDir: tmpDir('kb-idx-'), embedFn: fakeEmbed, dim: 4 });
    assert.strictEqual((await idx.ingest([work])).added.length, 1);
  });
  await t('index: listSources + removeSource end-to-end', async () => {
    const work = tmpDir('kb-idx-');
    fs.writeFileSync(path.join(work, 'a.txt'), 'apple');
    const idx = createIndex({ baseDir: tmpDir('kb-idx-'), embedFn: fakeEmbed, dim: 4 });
    await idx.ingest([work]);
    const sources = idx.listSources();
    assert.strictEqual(sources.length, 1);
    idx.removeSource(sources[0].id);
    assert.strictEqual(idx.listSources().length, 0);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
