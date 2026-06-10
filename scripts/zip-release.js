// Zips release/win-unpacked into release/Zeus-AI-win-x64.zip
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const root    = path.resolve(__dirname, '..');
const src     = path.join(root, 'release', 'win-unpacked');
const outZip  = path.join(root, 'release', 'Zeus-AI-win-x64.zip');

if (!fs.existsSync(src)) {
  console.error('win-unpacked folder not found — run npm run dist first');
  process.exit(1);
}

if (fs.existsSync(outZip)) fs.rmSync(outZip);

// Use PowerShell's Compress-Archive (available on all Windows 10+)
const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${src}\\*' -DestinationPath '${outZip}'"`;
console.log('Zipping release\\win-unpacked → release\\Zeus-AI-win-x64.zip ...');
execSync(cmd, { stdio: 'inherit' });

const size = (fs.statSync(outZip).size / 1024 / 1024).toFixed(1);
console.log(`Done! Zeus-AI-win-x64.zip (${size} MB) — share or copy anywhere.`);
