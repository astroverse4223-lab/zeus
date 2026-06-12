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
