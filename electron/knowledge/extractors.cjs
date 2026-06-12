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
