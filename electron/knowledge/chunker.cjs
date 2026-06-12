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
      // Only snap to a real break that sits late in the window; never collapse
      // `end` back to (or before) `start` when no break is found (lastBreak === -1).
      if (lastBreak > 0 && lastBreak > size - 200) end = start + lastBreak + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push({ text: piece, pos: chunks.length });
    if (end >= clean.length) break;
    // Always advance at least one char so the loop can never stall.
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

module.exports = { chunk };
