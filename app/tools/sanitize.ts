// Developer tool: writes a copy of a program with only structure and invented names.
import { openSync, readFileSync, closeSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBlocks, decode } from '../src/core/blocks';
import type { RawBlock } from '../src/core/types';

const SYMBOL_KEY = /^(H|PrH|SmC|mI|mO|DvH|OpF|C[0-9]+|mC|I[0-9]+|O[0-9]+)$/;

function symbolName(b: RawBlock): string | null {
  const h = b.get('H');
  const code = b.get('SmC');
  if (code === '156' || code === '157') return null;
  if (code === '155' || code === '103') return `module_${h}`;
  return `symbol_${h}`;
}

function write(entries: [string, string][]): string {
  return `[\r\n${entries.map(([k, v]) => `${k}=${v}`).join('\r\n')}\r\n]\r\n`;
}

export function sanitize(blocks: RawBlock[]): string {
  let out = '';
  for (const b of blocks) {
    const type = b.get('ObjTp');
    const h = b.get('H');
    if (type === 'FSgntr') {
      out += write([['ObjTp', 'FSgntr']]);
    } else if (type === 'Hd') {
      out += write([['ObjTp', 'Hd'], ['CltNm', 'Sample Program']]);
    } else if (type === 'Sg' && h) {
      const kind = b.get('SgTp');
      out += write([['ObjTp', 'Sg'], ['H', h], ['Nm', `sig_${h}`], ...(kind ? [['SgTp', kind] as [string, string]] : [])]);
    } else if (type === 'Sm' && h) {
      const name = symbolName(b);
      const kept = [...b].filter(([k]) => SYMBOL_KEY.test(k));
      const label: [string, string] = name ? ['Nm', name] : ['Cmn1', `folder_${h}`];
      out += write([['ObjTp', 'Sm'], ...kept, label]);
    }
  }
  return out;
}

function main(input: string, output: string): void {
  if (resolve(output).startsWith('/media/')) throw new Error('refusing to write under /media');
  const fd = openSync(input, 'r');
  const bytes = readFileSync(fd);
  closeSync(fd);
  writeFileSync(output, sanitize(readBlocks(decode(bytes))), 'latin1');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]!, process.argv[3]!);
}
