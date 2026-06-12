/**
 * Zeus AI — packaging script using @electron/packager
 * Produces: release/Zeus AI-win32-x64/Zeus AI.exe
 * Run via: node scripts/package-app.js
 */
const { packager } = require('@electron/packager');
const path     = require('path');
const fs       = require('fs');
const pkg      = require('../package.json');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('⚡ Packaging Zeus AI...\n');

  const appPaths = await packager({
    dir:          ROOT,
    name:         'Zeus AI',
    platform:     'win32',
    arch:         'x64',
    out:          path.join(ROOT, 'release'),
    overwrite:    true,
    asar:         false,
    icon:         path.join(ROOT, 'build', 'icon.ico'),   // packager auto-converts PNG→ICO if needed
    appVersion:   pkg.version,
    appCopyright: 'Copyright © 2025 Zeus AI',
    win32metadata: {
      CompanyName:      'Zeus AI',
      FileDescription:  'Zeus AI Computer Assistant',
      ProductName:      'Zeus AI',
      InternalName:     'zeus-ai',
    },
    ignore: [
      /^\/src\//,
      /^\/scripts\//,
      /^\/\.git\//,
      /^\/node_modules\/electron($|\/)/,
      /^\/release\//,
      /\.map$/,
      /^\/vite\.config/,
      /^\/tailwind\.config/,
      /^\/postcss\.config/,
    ],
  });

  console.log('\n✓ Packaged to:', appPaths[0]);

  // Create a zip for easy distribution
  const outDir  = appPaths[0];
  const zipPath = path.join(ROOT, 'release', 'Zeus-AI-win-x64.zip');
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

  console.log('📦 Creating Zeus-AI-win-x64.zip...');
  const { execSync } = require('child_process');
  // Use the 7za binary already bundled in node_modules (avoids PowerShell timestamp bugs)
  const sevenZa = path.join(ROOT, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
  try {
    execSync(`"${sevenZa}" a -tzip "${zipPath}" "${outDir}${path.sep}*" -mx=5 -mmt=on`, { stdio: 'pipe' });
    const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    console.log(`\n✅  Done!\n`);
    console.log(`  Run now:    release\\Zeus AI-win32-x64\\Zeus AI.exe`);
    console.log(`  Share/copy: release\\Zeus-AI-win-x64.zip  (${sizeMb} MB)`);
  } catch {
    console.log(`\n✅  Done! (zip step skipped)\n`);
    console.log(`  Run now:    release\\Zeus AI-win32-x64\\Zeus AI.exe`);
    console.log(`  To share:   zip the release\\Zeus AI-win32-x64\\ folder manually`);
  }
}

main().catch(err => {
  console.error('Build failed:', err.message || err);
  process.exit(1);
});
