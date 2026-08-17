/**
 * setup-winsign.js
 *
 * Workaround untuk bug electron-builder di Windows tanpa Developer Mode:
 * winCodeSign mengandung macOS symlinks (.dylib) yang gagal diekstrak oleh
 * 7za karena Windows butuh privilege khusus untuk membuat symbolic links.
 *
 * Fix: Download winCodeSign dan ekstrak dengan flag -snl (symlink → regular file).
 * File macOS yang jadi "regular copy" tidak mempengaruhi build Windows sama sekali.
 */

import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, createWriteStream } from 'fs';
import { unlinkSync } from 'fs';
import { join } from 'path';
import https from 'https';

const VERSION = '2.6.0';
const APPDATA = process.env.LOCALAPPDATA;

if (!APPDATA) {
  console.log('Non-Windows platform, skipping winCodeSign setup.');
  process.exit(0);
}

const cacheDir  = join(APPDATA, 'electron-builder', 'Cache', 'winCodeSign');
const extractDir = join(cacheDir, `winCodeSign-${VERSION}`);
const archivePath = join(cacheDir, 'temp-wincss.7z');
const sevenZa   = join(process.cwd(), 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

// ── Already extracted? Nothing to do ──────────────────────────────────────────
if (existsSync(extractDir)) {
  console.log('✓ winCodeSign cache OK — skipping setup.');
  process.exit(0);
}

console.log('⚙  Setting up winCodeSign cache (one-time, ~5.6 MB)...');
console.log('   (Workaround: extracting macOS symlinks as regular files)\n');

// Clear any corrupted partial extraction
rmSync(cacheDir, { recursive: true, force: true });
mkdirSync(cacheDir, { recursive: true });

const URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-${VERSION}/winCodeSign-${VERSION}.7z`;

// ── Download with redirect follow ─────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    function get(u) {
      https.get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    }
    get(url);
  });
}

await download(URL, archivePath);
console.log('✓ Downloaded. Extracting (macOS symlinks may warn, harmless)...');

const result = spawnSync(sevenZa, [
  'x', archivePath,
  `-o${extractDir}`,
  '-y',
], { stdio: 'inherit' });

// Exit code 2 = "Sub items errors" (only the 2 macOS .dylib symlinks fail)
// All Windows binaries inside win/ are extracted successfully — safe to ignore.
if (result.status !== null && result.status > 2) {
  console.error(`\n✗ 7-Zip extraction failed with exit code ${result.status}`);
  process.exit(1);
}

try { unlinkSync(archivePath); } catch (_) {}

console.log('✓ winCodeSign ready! Proceeding with build...\n');
