/**
 * Renders build/icon.svg, the one source of the app icon, into the files the
 * app and its packages use:
 *
 *   build/icon.png      1024px; electron-builder makes the Linux and macOS icons from it
 *   build/icon.ico      Windows, 16 to 256px
 *   resources/icon.png  512px; the window icon, loaded by src/main/index.ts
 *
 * The results are committed, so only changing the icon needs this and
 * rsvg-convert (apt install librsvg2-bin; brew install librsvg):
 *
 *   npm run icon
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'build', 'icon.svg'), 'utf8');

// At title-bar and taskbar sizes the fine detail turns to noise, so those
// sizes drop it and draw the frame and traces heavier.
const SMALL_LIMIT = 48;
const SMALL_STYLE = `<style>.detail{display:none}.frame{stroke-width:52}.trace{stroke-width:48}.block{stroke-width:0;fill:#72dbde}</style>`;
const small = source.replace('</svg>', `${SMALL_STYLE}</svg>`);

function render(size) {
  return execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-f', 'png'], {
    input: size <= SMALL_LIMIT ? small : source,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** An ICO whose images are all PNGs: one 6-byte header, 16 bytes per image, then the images. */
function ico(sizes) {
  const images = sizes.map(render);
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((image, i) => {
    const at = 6 + 16 * i;
    // In these two bytes 0 means 256.
    header[at] = sizes[i] % 256;
    header[at + 1] = sizes[i] % 256;
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(image.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += image.length;
  });
  return Buffer.concat([header, ...images]);
}

mkdirSync(join(root, 'resources'), { recursive: true });
writeFileSync(join(root, 'build', 'icon.png'), render(1024));
writeFileSync(join(root, 'resources', 'icon.png'), render(512));
writeFileSync(join(root, 'build', 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]));
console.log('wrote build/icon.png, build/icon.ico, resources/icon.png');
