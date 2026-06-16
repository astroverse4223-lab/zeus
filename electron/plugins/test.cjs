'use strict';
// Plain-assert runner (matches the other Zeus test files).
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseRepoUrl, slugify, pathMatchesSkills, modeApplies,
  installPlugin, listPlugins, removePlugin, loadEnabledSkills,
} = require('./index.cjs');

let passed = 0; const failures = [];
async function t(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`FAIL  ${name}\n      ${e && e.message}`); }
}
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-plugins-')); }

(async () => {
  await t('parseRepoUrl handles url, owner/repo, and tree/branch/subdir', () => {
    assert.deepStrictEqual(parseRepoUrl('owner/repo'), { owner: 'owner', repo: 'repo', branch: null, subdir: '' });
    assert.deepStrictEqual(parseRepoUrl('https://github.com/foo/bar.git'), { owner: 'foo', repo: 'bar', branch: null, subdir: '' });
    assert.deepStrictEqual(parseRepoUrl('https://github.com/foo/bar/tree/dev/pack/a'), { owner: 'foo', repo: 'bar', branch: 'dev', subdir: 'pack/a' });
    assert.throws(() => parseRepoUrl('notarepo'));
  });

  await t('slugify produces fs-safe names', () => {
    assert.strictEqual(slugify('Super Powers!'), 'super-powers');
    assert.strictEqual(slugify(''), 'plugin');
  });

  await t('pathMatchesSkills: defaults to .md (skips README), supports globs + exact', () => {
    assert.strictEqual(pathMatchesSkills('SKILL.md', null), true);
    assert.strictEqual(pathMatchesSkills('README.md', null), false);
    assert.strictEqual(pathMatchesSkills('notes.txt', null), false);
    assert.strictEqual(pathMatchesSkills('skills/a.md', ['skills/*.md']), true);
    assert.strictEqual(pathMatchesSkills('deep/b.md', ['**/*.md']), true);
    assert.strictEqual(pathMatchesSkills('only.md', ['only.md']), true);
    assert.strictEqual(pathMatchesSkills('x.md', ['only.md']), false);
  });

  await t('modeApplies: both matches everything, else exact', () => {
    assert.strictEqual(modeApplies('both', 'agent'), true);
    assert.strictEqual(modeApplies('agent', 'agent'), true);
    assert.strictEqual(modeApplies('chat', 'agent'), false);
    assert.strictEqual(modeApplies(undefined, 'chat'), true);
  });

  await t('installPlugin downloads skills + writes meta (mocked fetchers)', async () => {
    const base = tmp();
    const fetchJson = async (p) => {
      if (/\/git\/trees\//.test(p)) {
        return { tree: [
          { type: 'blob', path: 'zeus-plugin.json' },
          { type: 'blob', path: 'SKILL.md' },
          { type: 'blob', path: 'README.md' },
          { type: 'blob', path: 'node_modules/x.md' },
        ] };
      }
      return { default_branch: 'main' };
    };
    const fetchRaw = async (o, r, b, fp) => {
      if (fp === 'zeus-plugin.json') return JSON.stringify({ name: 'Demo Pack', mode: 'agent', version: '1.0.0' });
      if (fp === 'SKILL.md') return '# do the thing';
      return 'nope';
    };
    const meta = await installPlugin({ baseDir: base, url: 'foo/demo', fetchJson, fetchRaw });
    assert.strictEqual(meta.slug, 'demo-pack');
    assert.strictEqual(meta.mode, 'agent');
    assert.deepStrictEqual(meta.skills, ['SKILL.md']); // README + node_modules excluded
    assert.ok(fs.existsSync(path.join(base, 'demo-pack', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(base, 'demo-pack', 'skills', 'SKILL.md')));
  });

  await t('listPlugins + removePlugin round-trip', async () => {
    const base = tmp();
    const fetchJson = async (p) => /trees/.test(p)
      ? { tree: [{ type: 'blob', path: 'a.md' }] } : { default_branch: 'main' };
    const fetchRaw = async () => '# a';
    await installPlugin({ baseDir: base, url: 'foo/bar', fetchJson, fetchRaw });
    assert.strictEqual(listPlugins(base).length, 1);
    removePlugin(base, 'bar');
    assert.strictEqual(listPlugins(base).length, 0);
  });

  await t('loadEnabledSkills only injects enabled plugins matching the mode', async () => {
    const base = tmp();
    const fetchJson = async (p) => /trees/.test(p)
      ? { tree: [{ type: 'blob', path: 'zeus-plugin.json' }, { type: 'blob', path: 'SKILL.md' }] }
      : { default_branch: 'main' };
    const mkRaw = (name, mode) => async (o, r, b, fp) =>
      fp === 'zeus-plugin.json' ? JSON.stringify({ name, mode }) : `RULES of ${name}`;
    await installPlugin({ baseDir: base, url: 'x/agentpack', fetchJson, fetchRaw: mkRaw('AgentPack', 'agent') });
    await installPlugin({ baseDir: base, url: 'x/chatpack', fetchJson, fetchRaw: mkRaw('ChatPack', 'chat') });

    const agentText = loadEnabledSkills(base, ['agentpack', 'chatpack'], 'agent');
    assert.ok(agentText.includes('AgentPack'));
    assert.ok(!agentText.includes('ChatPack')); // chat-only excluded from agent mode

    assert.strictEqual(loadEnabledSkills(base, [], 'agent'), ''); // nothing enabled
    assert.ok(!loadEnabledSkills(base, ['chatpack'], 'agent').includes('ChatPack'));
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})();
