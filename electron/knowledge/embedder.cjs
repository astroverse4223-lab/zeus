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
