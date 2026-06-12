# Knowledge Base (Local RAG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user drag files/folders into Zeus, index them locally with Ollama embeddings, and have the model retrieve passages via a `knowledge_search` tool.

**Architecture:** A self-contained `electron/knowledge/` module (extractors → chunker → embedder → store, tied together by an orchestrator) is plumbed into the existing tool-registry → IPC → preload → renderer patterns. Vectors live in a `vectors.bin` Float32 sidecar; chunk text + metadata in `index.json`. Search is brute-force cosine. Embeddings come from the user's local Ollama (`nomic-embed-text`).

**Tech Stack:** Electron 32 (CommonJS main process), Node built-in `node:test` runner (no new test deps), `pdf-parse` for PDFs, React renderer.

**Spec:** `docs/superpowers/specs/2026-06-11-knowledge-base-rag-design.md`

---

## File Structure

**New (main process):**
- `electron/knowledge/chunker.cjs` — pure text → overlapping chunks
- `electron/knowledge/store.cjs` — JSON + `vectors.bin` persistence, cosine top-k
- `electron/knowledge/extractors.cjs` — path → text, folder expansion
- `electron/knowledge/embedder.cjs` — Ollama embeddings, typed errors
- `electron/knowledge/index.cjs` — orchestrator (ingest/search/list/remove)
- `electron/knowledge/*.test.cjs` — one test file per unit above

**New (renderer):**
- `src/components/KnowledgePanel.jsx` — drop zone, source list, status, progress

**Modified:**
- `electron/main.cjs` — KB IPC handlers + `knowledge_search` tool + execute case
- `electron/preload.cjs` — expose `kb*` methods + `onKbProgress`
- `src/components/Settings.jsx` — mount `KnowledgePanel`
- `src/App.jsx` — global window drag-drop → `kbAdd`
- `package.json` — add `pdf-parse` dep + `test` script

Each backend unit is pure or has a single injected boundary (Ollama HTTP), so all are unit-testable in isolation.

---

## Task 1: Test runner + scaffolding

**Files:**
- Modify: `package.json` (scripts)

- [ ] **Step 1: Add a test script to package.json**

In `package.json` `"scripts"`, add:

```json
    "test": "node --test electron/knowledge/"
```

- [ ] **Step 2: Verify the runner works (no tests yet = passes vacuously)**

Run: `npm test`
Expected: exits 0 with "tests 0" (no test files found yet).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add node:test runner script for knowledge module"
```

---

## Task 2: chunker.cjs (pure)

**Files:**
- Create: `electron/knowledge/chunker.cjs`
- Test: `electron/knowledge/chunker.test.cjs`

- [ ] **Step 1: Write the failing test**

`electron/knowledge/chunker.test.cjs`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { chunk } = require('./chunker.cjs');

test('empty or whitespace input yields no chunks', () => {
  assert.deepStrictEqual(chunk(''), []);
  assert.deepStrictEqual(chunk('   \n  '), []);
  assert.deepStrictEqual(chunk(null), []);
});

test('short text becomes a single chunk with pos 0', () => {
  const out = chunk('hello world');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].text, 'hello world');
  assert.strictEqual(out[0].pos, 0);
});

test('long text splits into multiple ordered, overlapping chunks', () => {
  const text = 'a'.repeat(2000);
  const out = chunk(text, { size: 800, overlap: 150 });
  assert.ok(out.length >= 3, `expected >=3 chunks, got ${out.length}`);
  out.forEach((c, i) => assert.strictEqual(c.pos, i));
  out.forEach((c) => assert.ok(c.text.length <= 800));
});

test('does not infinite-loop when overlap >= size', () => {
  const out = chunk('a'.repeat(500), { size: 100, overlap: 100 });
  assert.ok(out.length > 0 && out.length < 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test electron/knowledge/chunker.test.cjs`
Expected: FAIL — "Cannot find module './chunker.cjs'".

- [ ] **Step 3: Write minimal implementation**

`electron/knowledge/chunker.cjs`:

```js
'use strict';

/**
 * Split text into overlapping chunks, preferring sentence/line boundaries.
 * @param {string} text
 * @param {{size?:number, overlap?:number}} [opts]
 * @returns {{text:string, pos:number}[]}
 */
function chunk(text, opts = {}) {
  const size = opts.size ?? 800;
  let overlap = opts.overlap ?? 150;
  if (overlap >= size) overlap = Math.floor(size / 4); // guard against no forward progress

  const clean = String(text || '').replace(/\r\n/g, '\n');
  if (!clean.trim()) return [];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const lastBreak = Math.max(window.lastIndexOf('\n'), window.lastIndexOf('. '));
      if (lastBreak > size - 200) end = start + lastBreak + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push({ text: piece, pos: chunks.length });
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

module.exports = { chunk };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test electron/knowledge/chunker.test.cjs`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add electron/knowledge/chunker.cjs electron/knowledge/chunker.test.cjs
git commit -m "feat(kb): add text chunker with overlap"
```

---

## Task 3: store.cjs (persistence + cosine search)

**Files:**
- Create: `electron/knowledge/store.cjs`
- Test: `electron/knowledge/store.test.cjs`

- [ ] **Step 1: Write the failing test**

`electron/knowledge/store.test.cjs`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('./store.cjs');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kb-store-'));
}
function vec(arr, dim) {
  const v = new Float32Array(dim);
  for (let i = 0; i < arr.length; i++) v[i] = arr[i];
  return v;
}

test('add, persist, reload, and search round-trip', () => {
  const dim = 4;
  const dir = tmpDir();
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
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].text, 'apple');
  assert.strictEqual(hits[0].sourceName, 'a.txt');
  assert.ok(hits[0].score > 0.99);
});

test('removeSource compacts vectors and keeps search correct', () => {
  const dim = 4;
  const s = createStore(tmpDir(), { dim });
  s.load();
  s.addChunks({ id: 'A', path: '/a', name: 'A', type: 'text', addedAt: 'now' },
    [{ text: 'a', pos: 0 }], [vec([1, 0, 0, 0], dim)]);
  s.addChunks({ id: 'B', path: '/b', name: 'B', type: 'text', addedAt: 'now' },
    [{ text: 'b', pos: 0 }], [vec([0, 1, 0, 0], dim)]);
  s.removeSource('A');
  assert.strictEqual(s.stats().sourceCount, 1);
  assert.strictEqual(s.stats().chunkCount, 1);
  const hits = s.search(vec([0, 1, 0, 0], dim), 1);
  assert.strictEqual(hits[0].text, 'b'); // B's vector still aligned after compaction
});

test('corrupt index file loads as empty rather than throwing', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'index.json'), '{not json');
  const s = createStore(dir, { dim: 4 });
  assert.doesNotThrow(() => s.load());
  assert.strictEqual(s.stats().chunkCount, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test electron/knowledge/store.test.cjs`
Expected: FAIL — "Cannot find module './store.cjs'".

- [ ] **Step 3: Write minimal implementation**

`electron/knowledge/store.cjs`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function emptyState(dim) {
  return { version: 1, model: 'nomic-embed-text', dim, sources: [], chunks: [] };
}

/**
 * Vector store backed by index.json (metadata + chunk text) and
 * vectors.bin (flat Float32 array, `dim` floats per chunk).
 * @param {string} baseDir
 * @param {{dim?:number}} [opts]
 */
function createStore(baseDir, opts = {}) {
  const dim = opts.dim ?? 768;
  const indexPath = path.join(baseDir, 'index.json');
  const vecPath = path.join(baseDir, 'vectors.bin');
  let state = emptyState(dim);
  let vectors = new Float32Array(0); // flat: chunk i at [i*dim, i*dim+dim)

  function readVectors() {
    if (!fs.existsSync(vecPath)) return new Float32Array(0);
    const buf = fs.readFileSync(vecPath);
    const out = new Float32Array(Math.floor(buf.length / 4));
    for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4);
    return out;
  }

  function load() {
    try {
      state = fs.existsSync(indexPath)
        ? JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
        : emptyState(dim);
    } catch { state = emptyState(dim); }
    if (!state.dim) state.dim = dim;
    try { vectors = readVectors(); } catch { vectors = new Float32Array(0); }
    return state;
  }

  function save() {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(state, null, 2), 'utf-8');
    const buf = Buffer.alloc(vectors.length * 4);
    for (let i = 0; i < vectors.length; i++) buf.writeFloatLE(vectors[i], i * 4);
    fs.writeFileSync(vecPath, buf);
  }

  function addChunks(source, chunks, vecs) {
    const d = state.dim;
    const startOffset = state.chunks.length;
    const merged = new Float32Array(vectors.length + chunks.length * d);
    merged.set(vectors, 0);
    chunks.forEach((c, i) => {
      const vecOffset = startOffset + i;
      merged.set(vecs[i], vecOffset * d);
      state.chunks.push({ id: `${source.id}-${i}`, sourceId: source.id, pos: c.pos, text: c.text, vecOffset });
    });
    vectors = merged;
    state.sources.push({ ...source, chunkCount: chunks.length });
    save();
  }

  function removeSource(sourceId) {
    const d = state.dim;
    const keep = state.chunks.filter((c) => c.sourceId !== sourceId);
    const merged = new Float32Array(keep.length * d);
    keep.forEach((c, i) => {
      merged.set(vectors.subarray(c.vecOffset * d, c.vecOffset * d + d), i * d);
      c.vecOffset = i;
    });
    vectors = merged;
    state.chunks = keep;
    state.sources = state.sources.filter((s) => s.id !== sourceId);
    save();
  }

  function search(queryVec, k = 5) {
    const d = state.dim;
    const results = state.chunks.map((c) => {
      const off = c.vecOffset * d;
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < d; i++) {
        const a = queryVec[i], b = vectors[off + i];
        dot += a * b; na += a * a; nb += b * b;
      }
      const score = dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
      const src = state.sources.find((s) => s.id === c.sourceId);
      return { score, text: c.text, sourceName: src ? src.name : 'unknown', pos: c.pos };
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  function listSources() { return state.sources.map((s) => ({ ...s })); }
  function stats() {
    return { sourceCount: state.sources.length, chunkCount: state.chunks.length, model: state.model };
  }

  return { load, save, addChunks, removeSource, search, listSources, stats };
}

module.exports = { createStore };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test electron/knowledge/store.test.cjs`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add electron/knowledge/store.cjs electron/knowledge/store.test.cjs
git commit -m "feat(kb): add vector store with JSON+bin persistence and cosine search"
```

---

## Task 4: extractors.cjs (+ pdf-parse dep)

**Files:**
- Modify: `package.json` (dependencies)
- Create: `electron/knowledge/extractors.cjs`
- Test: `electron/knowledge/extractors.test.cjs`

- [ ] **Step 1: Install pdf-parse**

Run: `npm install pdf-parse@1.1.1`
Expected: adds `pdf-parse` to dependencies, no native build step.

- [ ] **Step 2: Write the failing test**

`electron/knowledge/extractors.test.cjs`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractText, expandPaths, classify } = require('./extractors.cjs');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'kb-ext-')); }

test('extractText reads UTF-8 text and code files', async () => {
  const dir = tmpDir();
  const f = path.join(dir, 'note.md');
  fs.writeFileSync(f, '# Title\nbody');
  assert.strictEqual(await extractText(f), '# Title\nbody');
});

test('extractText rejects unsupported binary types', async () => {
  const dir = tmpDir();
  const f = path.join(dir, 'pic.png');
  fs.writeFileSync(f, Buffer.from([0x89, 0x50]));
  await assert.rejects(() => extractText(f), (e) => e.code === 'UNSUPPORTED');
});

test('expandPaths recurses folders and skips node_modules/.git', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.writeFileSync(path.join(dir, 'node_modules', 'b.txt'), 'y');
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'sub', 'c.md'), 'z');
  fs.writeFileSync(path.join(dir, 'img.png'), 'binary');
  const files = expandPaths([dir]).map((f) => path.basename(f)).sort();
  assert.deepStrictEqual(files, ['a.txt', 'c.md']); // png + node_modules skipped
});

test('classify labels pdf vs text', () => {
  assert.strictEqual(classify('/x/y.pdf'), 'pdf');
  assert.strictEqual(classify('/x/y.md'), 'text');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test electron/knowledge/extractors.test.cjs`
Expected: FAIL — "Cannot find module './extractors.cjs'".

- [ ] **Step 4: Write minimal implementation**

`electron/knowledge/extractors.cjs`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TEXT_EXT = new Set([
  '.txt', '.md', '.markdown', '.json', '.csv', '.log',
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rs', '.rb', '.php', '.html', '.css', '.scss', '.sh',
  '.yml', '.yaml', '.xml', '.sql', '.toml', '.ini',
]);
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'release', 'build', '.next', '.cache']);
const MAX_BYTES = 5 * 1024 * 1024;

function classify(file) {
  return path.extname(file).toLowerCase() === '.pdf' ? 'pdf' : 'text';
}

async function extractText(file) {
  const ext = path.extname(file).toLowerCase();
  const size = fs.statSync(file).size;
  if (size > MAX_BYTES) throw Object.assign(new Error('File too large'), { code: 'TOO_LARGE' });
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(fs.readFileSync(file));
    return data.text || '';
  }
  if (TEXT_EXT.has(ext)) return fs.readFileSync(file, 'utf-8');
  throw Object.assign(new Error('Unsupported file type'), { code: 'UNSUPPORTED' });
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else {
      const ext = path.extname(name).toLowerCase();
      if (ext === '.pdf' || TEXT_EXT.has(ext)) out.push(full);
    }
  }
}

function expandPaths(paths) {
  const out = [];
  for (const p of paths) {
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

module.exports = { extractText, expandPaths, classify, TEXT_EXT, MAX_BYTES };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test electron/knowledge/extractors.test.cjs`
Expected: PASS — all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json electron/knowledge/extractors.cjs electron/knowledge/extractors.test.cjs
git commit -m "feat(kb): add file/folder extractors with pdf-parse"
```

---

## Task 5: embedder.cjs (Ollama, typed errors)

**Files:**
- Create: `electron/knowledge/embedder.cjs`
- Test: `electron/knowledge/embedder.test.cjs`

- [ ] **Step 1: Write the failing test**

The test spins a real local HTTP server to stand in for Ollama (no mocking framework needed).

`electron/knowledge/embedder.test.cjs`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { embed } = require('./embedder.cjs');

function server(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ port: s.address().port, close: () => s.close() }));
  });
}

test('embed returns Float32Array vectors and reports progress', async () => {
  const srv = await server((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ embedding: [0.1, 0.2, 0.3] }));
  });
  const seen = [];
  const out = await embed(['hello', 'world'], {
    host: '127.0.0.1', port: srv.port, onProgress: (d, t) => seen.push([d, t]),
  });
  srv.close();
  assert.strictEqual(out.length, 2);
  assert.ok(out[0] instanceof Float32Array);
  assert.deepStrictEqual([...out[0]], [Math.fround(0.1), Math.fround(0.2), Math.fround(0.3)]);
  assert.deepStrictEqual(seen, [[1, 2], [2, 2]]);
});

test('maps a missing-model response to MODEL_MISSING', async () => {
  const srv = await server((req, res) => {
    res.end(JSON.stringify({ error: 'model "nomic-embed-text" not found, try pulling it first' }));
  });
  await assert.rejects(
    () => embed(['x'], { host: '127.0.0.1', port: srv.port }),
    (e) => e.code === 'MODEL_MISSING'
  );
  srv.close();
});

test('maps connection refused to OLLAMA_DOWN', async () => {
  // port 1 is reserved and refuses connections
  await assert.rejects(
    () => embed(['x'], { host: '127.0.0.1', port: 1 }),
    (e) => e.code === 'OLLAMA_DOWN'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test electron/knowledge/embedder.test.cjs`
Expected: FAIL — "Cannot find module './embedder.cjs'".

- [ ] **Step 3: Write minimal implementation**

`electron/knowledge/embedder.cjs`:

```js
'use strict';

const http = require('node:http');

const DEFAULTS = { model: 'nomic-embed-text', host: 'localhost', port: 11434 };

function embedOne(text, opts = {}) {
  const { model, host, port } = { ...DEFAULTS, ...opts };
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ model, prompt: text });
    const req = http.request({
      hostname: host, port, path: '/api/embeddings', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); }
        catch { return reject(Object.assign(new Error('Bad Ollama response'), { code: 'BAD_RESPONSE' })); }
        if (json.error) {
          const missing = /not found|try pulling/i.test(json.error);
          return reject(Object.assign(new Error(json.error), { code: missing ? 'MODEL_MISSING' : 'OLLAMA_ERROR' }));
        }
        if (!Array.isArray(json.embedding)) {
          return reject(Object.assign(new Error('No embedding in response'), { code: 'BAD_RESPONSE' }));
        }
        resolve(Float32Array.from(json.embedding));
      });
    });
    req.on('error', (e) => {
      if (e.code === 'ECONNREFUSED') return reject(Object.assign(new Error('Ollama is not running'), { code: 'OLLAMA_DOWN' }));
      reject(e);
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Embed an array of texts sequentially.
 * @param {string[]} texts
 * @param {{model?:string,host?:string,port?:number,onProgress?:(done:number,total:number)=>void}} [opts]
 * @returns {Promise<Float32Array[]>}
 */
async function embed(texts, opts = {}) {
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    out.push(await embedOne(texts[i], opts));
    if (opts.onProgress) opts.onProgress(i + 1, texts.length);
  }
  return out;
}

module.exports = { embed, embedOne };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test electron/knowledge/embedder.test.cjs`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add electron/knowledge/embedder.cjs electron/knowledge/embedder.test.cjs
git commit -m "feat(kb): add Ollama embedder with typed errors"
```

---

## Task 6: index.cjs (orchestrator)

**Files:**
- Create: `electron/knowledge/index.cjs`
- Test: `electron/knowledge/index.test.cjs`

- [ ] **Step 1: Write the failing test**

The orchestrator takes an injectable `embedFn` so the test never touches Ollama.

`electron/knowledge/index.test.cjs`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createIndex } = require('./index.cjs');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'kb-idx-')); }

// Deterministic fake embedder: 4-dim one-hot by keyword.
async function fakeEmbed(texts) {
  return texts.map((t) => {
    const v = new Float32Array(4);
    if (t.includes('apple')) v[0] = 1;
    else if (t.includes('banana')) v[1] = 1;
    else v[2] = 1;
    return v;
  });
}

test('ingest indexes a folder and search retrieves the right source', async () => {
  const work = tmpDir();
  fs.writeFileSync(path.join(work, 'fruit.txt'), 'apple apple apple');
  fs.writeFileSync(path.join(work, 'other.md'), 'banana banana');

  const idx = createIndex({ baseDir: tmpDir(), embedFn: fakeEmbed, dim: 4 });
  const result = await idx.ingest([work]);
  assert.strictEqual(result.added.length, 2);

  const hits = await idx.search('apple', 1);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].sourceName, 'fruit.txt');
});

test('ingest skips unsupported files without throwing', async () => {
  const work = tmpDir();
  fs.writeFileSync(path.join(work, 'keep.txt'), 'apple');
  fs.writeFileSync(path.join(work, 'skip.png'), Buffer.from([0x89]));
  const idx = createIndex({ baseDir: tmpDir(), embedFn: fakeEmbed, dim: 4 });
  const result = await idx.ingest([work]);
  assert.strictEqual(result.added.length, 1);
});

test('listSources and removeSource work end-to-end', async () => {
  const work = tmpDir();
  fs.writeFileSync(path.join(work, 'a.txt'), 'apple');
  const idx = createIndex({ baseDir: tmpDir(), embedFn: fakeEmbed, dim: 4 });
  await idx.ingest([work]);
  const sources = idx.listSources();
  assert.strictEqual(sources.length, 1);
  idx.removeSource(sources[0].id);
  assert.strictEqual(idx.listSources().length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test electron/knowledge/index.test.cjs`
Expected: FAIL — "Cannot find module './index.cjs'".

- [ ] **Step 3: Write minimal implementation**

`electron/knowledge/index.cjs`:

```js
'use strict';

const path = require('node:path');
const { chunk } = require('./chunker.cjs');
const { createStore } = require('./store.cjs');
const extractors = require('./extractors.cjs');
const { embed } = require('./embedder.cjs');

/**
 * @param {{baseDir:string, embedFn?:Function, dim?:number}} cfg
 */
function createIndex(cfg) {
  const dim = cfg.dim ?? 768;
  const embedFn = cfg.embedFn ?? embed;
  const store = createStore(cfg.baseDir, { dim });
  store.load();

  async function ingest(paths, onProgress) {
    const files = extractors.expandPaths(paths);
    const result = { added: [], skipped: [] };
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (onProgress) onProgress({ file, done: i, total: files.length, phase: 'extract' });
        const text = await extractors.extractText(file);
        const chunks = chunk(text);
        if (!chunks.length) { result.skipped.push({ file, reason: 'empty' }); continue; }
        if (onProgress) onProgress({ file, done: i, total: files.length, phase: 'embed' });
        const vecs = await embedFn(chunks.map((c) => c.text));
        const source = {
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          path: file, name: path.basename(file), type: extractors.classify(file),
          addedAt: new Date().toISOString(),
        };
        store.addChunks(source, chunks, vecs);
        result.added.push({ name: source.name, chunks: chunks.length });
      } catch (e) {
        result.skipped.push({ file, reason: e.code || e.message });
      }
    }
    if (onProgress) onProgress({ done: files.length, total: files.length, phase: 'done' });
    return result;
  }

  async function search(query, k = 5) {
    const [qv] = await embedFn([query]);
    return store.search(qv, k);
  }

  return {
    ingest,
    search,
    removeSource: (id) => store.removeSource(id),
    listSources: () => store.listSources(),
    stats: () => store.stats(),
  };
}

module.exports = { createIndex };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test electron/knowledge/index.test.cjs`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Run the whole knowledge suite**

Run: `npm test`
Expected: PASS — all knowledge test files green.

- [ ] **Step 6: Commit**

```bash
git add electron/knowledge/index.cjs electron/knowledge/index.test.cjs
git commit -m "feat(kb): add ingest/search orchestrator"
```

---

## Task 7: Wire into main.cjs (IPC + knowledge_search tool)

**Files:**
- Modify: `electron/main.cjs`

No automated test (Electron main process); verified manually in Task 11.

- [ ] **Step 1: Create the knowledge singleton**

Near the top of `electron/main.cjs`, after the line defining `SETTINGS_FILE` (~line 18), add:

```js
const { createIndex } = require('./knowledge/index.cjs');
let _knowledge = null;
function getKnowledge() {
  if (!_knowledge) {
    _knowledge = createIndex({ baseDir: path.join(app.getPath('userData'), 'knowledge') });
  }
  return _knowledge;
}
```

- [ ] **Step 2: Add KB IPC handlers**

Immediately after the existing `zeus:pick-directory` handler (ends ~line 287), add:

```js
// ─── Knowledge Base IPC ───────────────────────────────────────────────────────
ipcMain.handle('zeus:kb-pick-files', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'ZEUS — Add files to Knowledge Base',
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('zeus:kb-add', async (e, paths) => {
  if (!Array.isArray(paths) || !paths.length) return { added: [], skipped: [] };
  const wc = e.sender;
  try {
    return await getKnowledge().ingest(paths, (p) => {
      if (!wc.isDestroyed()) wc.send('zeus:kb-progress', p);
    });
  } catch (err) {
    return { error: err.code || err.message, added: [], skipped: [] };
  }
});

ipcMain.handle('zeus:kb-list', () => getKnowledge().listSources());
ipcMain.handle('zeus:kb-remove', (_, id) => {
  getKnowledge().removeSource(id);
  return getKnowledge().listSources();
});
ipcMain.handle('zeus:kb-stats', () => getKnowledge().stats());
```

- [ ] **Step 3: Register the `knowledge_search` tool**

In the `TOOLS` array (starts ~line 524), after the `memory_delete` entry (ends ~line 777), add:

```js
  {
    name: 'knowledge_search',
    description: "Search the user's indexed personal documents / knowledge base for relevant passages. Use whenever the user asks about their own files, notes, manuals, PDFs, or documents they have added to Zeus.",
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for in the user\'s documents' },
        k: { type: 'number', description: 'How many passages to return (default 5)' },
      },
      required: ['query'],
    },
    dangerous: false,
  },
```

- [ ] **Step 4: Add the execute case**

In `executeTool`'s `switch` (starts ~line 998), after the `memory_delete` case, add:

```js
      case 'knowledge_search': {
        try {
          const hits = await getKnowledge().search(input.query, input.k || 5);
          if (!hits.length) {
            return { results: [], message: 'Knowledge base is empty or no relevant passages found. Ask the user to add documents in the Knowledge panel.' };
          }
          return {
            count: hits.length,
            results: hits.map((h) => ({ source: h.sourceName, score: Number(h.score.toFixed(3)), text: h.text })),
          };
        } catch (err) {
          if (err.code === 'OLLAMA_DOWN') return { error: 'Ollama is not running. Start Ollama to search the knowledge base.' };
          if (err.code === 'MODEL_MISSING') return { error: 'Embedding model missing. Run: ollama pull nomic-embed-text' };
          return { error: err.message };
        }
      }
```

- [ ] **Step 5: Add an agent-log summary line (optional polish)**

In the tool-summary `switch` (~line 880), add alongside the other cases:

```js
    case 'knowledge_search': return `[kb?]   "${input.query}" (${result.count ?? 0} hits)`;
```

- [ ] **Step 6: Verify the renderer still builds**

Run: `npm run build`
Expected: Vite build succeeds. Full runtime check is Task 11.

- [ ] **Step 7: Commit**

```bash
git add electron/main.cjs
git commit -m "feat(kb): add KB IPC handlers and knowledge_search tool"
```

---

## Task 8: Expose KB API in preload

**Files:**
- Modify: `electron/preload.cjs`

- [ ] **Step 1: Add the KB bridge**

In `electron/preload.cjs`, inside the `contextBridge.exposeInMainWorld('zeus', { ... })` object, before the closing `});` (after the `onMiniMessage` block, ~line 81), add:

```js
  // Knowledge base
  kbAdd:       (paths) => ipcRenderer.invoke('zeus:kb-add', paths),
  kbPickFiles: ()      => ipcRenderer.invoke('zeus:kb-pick-files'),
  kbList:      ()      => ipcRenderer.invoke('zeus:kb-list'),
  kbRemove:    (id)    => ipcRenderer.invoke('zeus:kb-remove', id),
  kbStats:     ()      => ipcRenderer.invoke('zeus:kb-stats'),
  onKbProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('zeus:kb-progress', handler);
    return () => ipcRenderer.removeListener('zeus:kb-progress', handler);
  },
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.cjs
git commit -m "feat(kb): expose knowledge base API on window.zeus"
```

---

## Task 9: Knowledge panel UI

**Files:**
- Create: `src/components/KnowledgePanel.jsx`
- Modify: `src/components/Settings.jsx`

- [ ] **Step 1: Create the panel component**

`src/components/KnowledgePanel.jsx`:

```jsx
import React, { useEffect, useState, useCallback } from 'react';

const labelStyle = { fontSize: 11, letterSpacing: '0.08em', color: 'var(--c-accent)', fontWeight: 600 };

export default function KnowledgePanel() {
  const [sources, setSources] = useState([]);
  const [stats, setStats] = useState({ sourceCount: 0, chunkCount: 0, model: 'nomic-embed-text' });
  const [progress, setProgress] = useState(null); // { file, done, total, phase }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!window.zeus) return;
    setSources(await window.zeus.kbList());
    setStats(await window.zeus.kbStats());
  }, []);

  useEffect(() => {
    refresh();
    const off = window.zeus?.onKbProgress?.((p) => setProgress(p.phase === 'done' ? null : p));
    return () => off && off();
  }, [refresh]);

  const add = useCallback(async (paths) => {
    if (!paths || !paths.length) return;
    setBusy(true); setError('');
    const res = await window.zeus.kbAdd(paths);
    setBusy(false); setProgress(null);
    if (res?.error) setError(String(res.error));
    refresh();
  }, [refresh]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const paths = Array.from(e.dataTransfer.files || []).map((f) => f.path).filter(Boolean);
    add(paths);
  }, [add]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>KNOWLEDGE BASE</label>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          {stats.sourceCount} sources · {stats.chunkCount} chunks · model {stats.model}
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{
          border: '1px dashed var(--c-border)', borderRadius: 8, padding: 20,
          textAlign: 'center', fontSize: 13, opacity: busy ? 0.6 : 1,
          background: 'rgba(0,212,255,0.03)',
        }}
      >
        Drag files or a folder here
        <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={async () => add(await window.zeus.kbPickFiles())}
            className="glow-border" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12 }}
          >Add files</button>
          <button
            onClick={async () => { const d = await window.zeus.pickDirectory(); if (d) add([d]); }}
            className="glow-border" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12 }}
          >Add folder</button>
        </div>
      </div>

      {progress && (
        <div style={{ fontSize: 11, opacity: 0.8 }}>
          {progress.phase === 'embed' ? 'Embedding' : 'Reading'} {progress.file?.split(/[\\/]/).pop()} … ({progress.done}/{progress.total})
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: '#ff6b6b' }}>⚠ {error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sources.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>No documents indexed yet.</div>}
        {sources.map((s) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', fontSize: 12,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.type === 'pdf' ? '📄' : '📝'} {s.name}
              <span style={{ opacity: 0.5 }}> · {s.chunkCount} chunks</span>
            </span>
            <button
              onClick={async () => { await window.zeus.kbRemove(s.id); refresh(); }}
              style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 14 }}
              title="Remove"
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in Settings**

In `src/components/Settings.jsx`, add the import at the top with the other imports:

```jsx
import KnowledgePanel from './KnowledgePanel.jsx';
```

Then render `<KnowledgePanel />` as a new section. Place it immediately after the closing `</div>` of the `BACKGROUND PATTERN` block (around line 245), matching how sibling sections are wrapped:

```jsx
        <div style={{ marginTop: 18, borderTop: '1px solid var(--c-border)', paddingTop: 18 }}>
          <KnowledgePanel />
        </div>
```

- [ ] **Step 3: Build to verify the renderer compiles**

Run: `npm run build`
Expected: Vite build succeeds with no JSX errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/KnowledgePanel.jsx src/components/Settings.jsx
git commit -m "feat(kb): add Knowledge panel UI in Settings"
```

---

## Task 10: Global window drag-drop

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add a global drop handler**

In `src/App.jsx`, add a `useEffect` near the other top-level effects (e.g. after the UI-settings effect that ends ~line 70):

```jsx
  // Global drag-drop → add files to the knowledge base
  useEffect(() => {
    const onDragOver = (e) => { e.preventDefault(); };
    const onDrop = (e) => {
      e.preventDefault();
      const paths = Array.from(e.dataTransfer?.files || []).map((f) => f.path).filter(Boolean);
      if (paths.length && window.zeus?.kbAdd) window.zeus.kbAdd(paths);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Vite build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(kb): add global window drag-drop to index files"
```

---

## Task 11: Manual end-to-end verification + docs

**Files:**
- Modify: `README.md` (feature list)

- [ ] **Step 1: Prep Ollama**

Run: `ollama pull nomic-embed-text`
Expected: model downloads (~270 MB). Confirm `ollama list` shows it.

- [ ] **Step 2: Launch and exercise the feature**

Run: `npm run dev`
Then in the app:
1. Open Settings → Knowledge panel. Confirm it shows "0 sources · 0 chunks".
2. Click "Add files", pick a `.txt`/`.md`/`.pdf`. Watch the progress line, then confirm it appears in the source list with a chunk count.
3. Drag a folder onto the window. Confirm multiple files index and `node_modules`-style junk is skipped.
4. In chat, ask a question answerable only from the added doc. Confirm Zeus calls `knowledge_search` (visible in tool activity) and answers from the content.
5. Stop Ollama, ask again. Confirm Zeus reports the "Ollama is not running" message instead of crashing.
6. Remove a source via the ✕ button; confirm the list and counts update.

Expected: all six behaviors pass.

- [ ] **Step 3: Run the full unit suite once more**

Run: `npm test`
Expected: PASS — all knowledge tests green.

- [ ] **Step 4: Update README feature list**

In `README.md`, add to the features list:

```markdown
- Local knowledge base (RAG): drag files/folders in, indexed privately via Ollama embeddings, searched on demand with the `knowledge_search` tool
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document local knowledge base (RAG) feature"
```

---

## Self-Review Notes

- **Spec coverage:** §3.1 modules → Tasks 2–6; §3.2 storage → Task 3; §3.3 IPC/preload → Tasks 7–8; §3.4 tool → Task 7; §4 UI → Task 9; global drag-drop → Task 10; §5 error handling → embedder typed errors (Task 5) surfaced in tool (Task 7) and UI (Task 9); §6 testing → Tasks 2–6 test files.
- **Deviation from spec §3.3:** `zeus:kb-stats` returns counts + model only (no `ollamaReady`). Ollama readiness can be shown via the existing `ollamaStatus`/`ollamaModels` APIs rather than duplicating a probe. Acceptable simplification; revisit in UI polish if desired.
- **Type consistency:** `createStore(baseDir,{dim})`, `createIndex({baseDir,embedFn,dim})`, `embed(texts,{host,port,model,onProgress})`, `ingest(paths,onProgress)`, `search(query,k)`, and the `{score,text,sourceName,pos}` hit shape are used identically across tasks and the `main.cjs`/UI consumers.
- **No placeholders:** every code step contains complete, runnable code and exact commands.
```
