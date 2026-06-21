'use strict';

// ─── Zeus Password Vault ───────────────────────────────────────────────────────
// A small local password manager. Entries are encrypted at rest with AES-256-GCM
// using a key derived from the user's master password via PBKDF2 (210k rounds).
// The master password itself is never stored — only a salt + the encrypted blob.
// GCM's auth tag doubles as the "is this the right password" check: a wrong key
// fails decryption rather than silently producing garbage.
//
// The derived key lives only in memory (inside the object returned by createVault)
// for as long as the vault is unlocked. Locking (or quitting the app) discards it.

const crypto = require('crypto');
const fs = require('fs');

const ITERATIONS = 210000;
const KEY_LEN = 32;
const DIGEST = 'sha256';
const ALGO = 'aes-256-gcm';

function deriveKey(password, salt, iterations = ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LEN, DIGEST);
}

function encryptJSON(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf-8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decryptJSON(blob, key) {
  const iv = Buffer.from(blob.iv, 'base64');
  const ciphertext = Buffer.from(blob.ciphertext, 'base64');
  const authTag = Buffer.from(blob.authTag, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf-8'));
}

const AMBIGUOUS = /[Il1O0]/;
const CHARSETS = {
  lower:   'abcdefghijklmnopqrstuvwxyz',
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~',
};

/** Cryptographically-random password generator (rejection-free via crypto.randomInt). */
function generatePassword(opts = {}) {
  const {
    length = 16,
    lower = true,
    upper = true,
    numbers = true,
    symbols = true,
    excludeAmbiguous = false,
  } = opts;

  let charset = '';
  if (lower) charset += CHARSETS.lower;
  if (upper) charset += CHARSETS.upper;
  if (numbers) charset += CHARSETS.numbers;
  if (symbols) charset += CHARSETS.symbols;
  if (excludeAmbiguous) charset = charset.split('').filter(c => !AMBIGUOUS.test(c)).join('');
  if (!charset) throw new Error('Select at least one character set');

  const len = Math.max(4, Math.min(128, Math.floor(length) || 16));
  let out = '';
  for (let i = 0; i < len; i++) out += charset[crypto.randomInt(0, charset.length)];
  return out;
}

/** Quick heuristic strength score (0-4) + label, for a UI meter — not a substitute
 *  for the real entropy of a generated password, just feedback for typed-in ones. */
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: 'Empty' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  score = Math.min(4, score);
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { score, label: labels[score] };
}

function createVault({ filePath }) {
  let key = null;
  let entries = null;

  const exists = () => fs.existsSync(filePath);
  const isUnlocked = () => key !== null;

  function readFile() {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  function writeFile(doc) {
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8');
  }
  function persist() {
    const doc = exists() ? readFile() : { version: 1 };
    writeFile({ ...doc, ...encryptJSON(entries, key) });
  }

  function setup(masterPassword) {
    if (!masterPassword || masterPassword.length < 4) throw new Error('Master password must be at least 4 characters');
    if (exists()) throw new Error('Vault already exists');
    const salt = crypto.randomBytes(16);
    key = deriveKey(masterPassword, salt);
    entries = [];
    writeFile({
      version: 1,
      salt: salt.toString('base64'),
      iterations: ITERATIONS,
      ...encryptJSON(entries, key),
    });
  }

  function unlock(masterPassword) {
    const doc = readFile();
    const salt = Buffer.from(doc.salt, 'base64');
    const candidateKey = deriveKey(masterPassword, salt, doc.iterations || ITERATIONS);
    let decrypted;
    try {
      decrypted = decryptJSON(doc, candidateKey);
    } catch {
      throw new Error('Incorrect master password');
    }
    key = candidateKey;
    entries = decrypted;
  }

  function lock() {
    key = null;
    entries = null;
  }

  function assertUnlocked() {
    if (!isUnlocked()) throw new Error('Vault is locked');
  }

  function list() {
    assertUnlocked();
    return [...entries].sort((a, b) => a.label.localeCompare(b.label));
  }

  function add(entry) {
    assertUnlocked();
    const now = new Date().toISOString();
    const rec = {
      id: crypto.randomUUID(),
      label: entry.label || '',
      username: entry.username || '',
      password: entry.password || '',
      url: entry.url || '',
      notes: entry.notes || '',
      createdAt: now,
      updatedAt: now,
    };
    entries.push(rec);
    persist();
    return rec;
  }

  function update(id, patch) {
    assertUnlocked();
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) throw new Error('Entry not found');
    entries[idx] = { ...entries[idx], ...patch, id, updatedAt: new Date().toISOString() };
    persist();
    return entries[idx];
  }

  function remove(id) {
    assertUnlocked();
    entries = entries.filter(e => e.id !== id);
    persist();
  }

  /** Destroys the vault file entirely — for "forgot master password" recovery. */
  function reset() {
    lock();
    if (exists()) fs.unlinkSync(filePath);
  }

  return { exists, isUnlocked, setup, unlock, lock, list, add, update, remove, reset };
}

module.exports = { createVault, generatePassword, passwordStrength };
