/**
 * Zips dist/mac/<productName>.app for npm run build:mac on Linux.
 *
 * electron-builder's own zip follows symlinks when cross-building, which
 * copies the framework repeatedly and breaks the bundle's signature. So
 * build:mac asks for the unpacked app (`--mac dir`) and this zips it with
 * Info-ZIP's `zip -y`, which stores a symlink as a symlink.
 *
 * Same name electron-builder gives the zip: <productName>-<version>-mac.zip.
 * scripts/build/build-macos.sh, on a Mac, still lets electron-builder zip.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const productName = /^productName:\s*(.+?)\s*$/m.exec(readFileSync(join(root, 'electron-builder.yml'), 'utf8'))?.[1];
if (!productName) {
  console.error('zip-mac: electron-builder.yml has no productName');
  process.exit(1);
}
const appDir = join(root, 'dist', 'mac');
const app = `${productName}.app`;
const zip = join(root, 'dist', `${productName}-${version}-mac.zip`);

if (!existsSync(join(appDir, app))) {
  console.error(`zip-mac: ${join(appDir, app)} is missing; run electron-builder --mac dir first`);
  process.exit(1);
}
try {
  execFileSync('zip', ['-v'], { stdio: 'ignore' });
} catch {
  console.error('zip-mac: Info-ZIP `zip` is not installed (apt install zip)');
  process.exit(1);
}

// zip adds to an existing archive; start from nothing.
rmSync(zip, { force: true });
// -r recurse, -y store symlinks as links, -X no extra file attributes, -q quiet
execFileSync('zip', ['-qryX', zip, app], { cwd: appDir, stdio: 'inherit' });
console.log(`zip-mac: ${zip}`);
