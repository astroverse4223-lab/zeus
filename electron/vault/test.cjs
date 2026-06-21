'use strict';
// Plain-assert runner (matches the other Zeus test files).
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createVault, generatePassword, passwordStrength } = require('./index.cjs');

let passed = 0; const failures = [];
async function t(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`FAIL  ${name}\n      ${e && e.message}`); }
}
function tmpFile() { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-vault-')), 'vault.json'); }

(async () => {
  await t('setup + unlock round-trip with correct password', () => {
    const vault = createVault({ filePath: tmpFile() });
    assert.strictEqual(vault.exists(), false);
    vault.setup('correct-horse');
    assert.strictEqual(vault.exists(), true);
    assert.strictEqual(vault.isUnlocked(), true);
    vault.lock();
    assert.strictEqual(vault.isUnlocked(), false);
    vault.unlock('correct-horse');
    assert.strictEqual(vault.isUnlocked(), true);
    assert.deepStrictEqual(vault.list(), []);
  });

  await t('unlock rejects a wrong master password', () => {
    const vault = createVault({ filePath: tmpFile() });
    vault.setup('right-password');
    vault.lock();
    assert.throws(() => vault.unlock('wrong-password'), /Incorrect master password/);
    assert.strictEqual(vault.isUnlocked(), false);
  });

  await t('setup refuses to run twice on the same file', () => {
    const vault = createVault({ filePath: tmpFile() });
    vault.setup('first-password');
    assert.throws(() => vault.setup('second-password'), /already exists/);
  });

  await t('operations on a locked vault throw', () => {
    const vault = createVault({ filePath: tmpFile() });
    assert.throws(() => vault.list(), /locked/);
    assert.throws(() => vault.add({ label: 'x' }), /locked/);
  });

  await t('add/list/update/remove entries, persisted across lock/unlock', () => {
    const file = tmpFile();
    const vault = createVault({ filePath: file });
    vault.setup('pw123');
    const rec = vault.add({ label: 'GitHub', username: 'me@example.com', password: 'p@ss', url: 'https://github.com' });
    assert.ok(rec.id);
    assert.strictEqual(vault.list().length, 1);

    vault.update(rec.id, { password: 'newpass' });
    assert.strictEqual(vault.list()[0].password, 'newpass');

    // Reopen the vault from disk as a fresh object — entries must survive.
    vault.lock();
    const reopened = createVault({ filePath: file });
    reopened.unlock('pw123');
    assert.strictEqual(reopened.list()[0].password, 'newpass');

    reopened.remove(rec.id);
    assert.deepStrictEqual(reopened.list(), []);
  });

  await t('reset deletes the vault file entirely', () => {
    const file = tmpFile();
    const vault = createVault({ filePath: file });
    vault.setup('pw1234');
    assert.strictEqual(fs.existsSync(file), true);
    vault.reset();
    assert.strictEqual(fs.existsSync(file), false);
    assert.strictEqual(vault.isUnlocked(), false);
  });

  await t('generatePassword respects length and charset toggles', () => {
    const onlyDigits = generatePassword({ length: 24, lower: false, upper: false, numbers: true, symbols: false });
    assert.strictEqual(onlyDigits.length, 24);
    assert.match(onlyDigits, /^[0-9]+$/);

    const noSymbols = generatePassword({ length: 40, symbols: false });
    assert.ok(!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?/~]/.test(noSymbols));
  });

  await t('generatePassword can exclude ambiguous characters', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generatePassword({ length: 30, excludeAmbiguous: true });
      assert.ok(!/[Il1O0]/.test(pw));
    }
  });

  await t('generatePassword throws if every charset is disabled', () => {
    assert.throws(() => generatePassword({ lower: false, upper: false, numbers: false, symbols: false }));
  });

  await t('passwordStrength scores weak vs strong differently', () => {
    assert.strictEqual(passwordStrength('').score, 0);
    assert.ok(passwordStrength('abc').score < passwordStrength('Tr0ub4dor&3xtra!').score);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})();
