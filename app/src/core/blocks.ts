import type { Classified, RawBlock } from './types';

const PROTECTED_MARKER = 'FeSchVr=001';

export function decode(bytes: Uint8Array): string {
  return new TextDecoder('windows-1252').decode(bytes);
}

export function readBlocks(text: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;
  for (const line of text.split(/\r\n|\n|\r/)) {
    if (line === '[') {
      current = new Map();
    } else if (line === ']') {
      if (current) blocks.push(current);
      current = null;
    } else if (current) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const key = line.slice(0, eq);
        if (!current.has(key)) current.set(key, line.slice(eq + 1));
      }
    }
  }
  return blocks;
}

export function classify(bytes: Uint8Array): Classified {
  const text = decode(bytes);
  const hasObjects = text.includes('ObjTp=');
  if (text.includes(PROTECTED_MARKER)) {
    const header = hasObjects ? readBlocks(text).find((b) => b.get('ObjTp') === 'Hd') : undefined;
    return { status: 'protected', name: header?.get('PrNm') ?? null };
  }
  if (!hasObjects) return { status: 'unreadable' };
  return { status: 'ok', blocks: readBlocks(text) };
}
