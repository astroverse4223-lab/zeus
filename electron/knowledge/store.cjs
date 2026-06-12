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
