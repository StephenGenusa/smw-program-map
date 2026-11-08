import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const OUT = new URL('../out/', import.meta.url).pathname;
const files = readdirSync(OUT, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
const all = files.map((f) => readFileSync(f, 'latin1')).join('\n');
const count = (needle: string) => all.split(needle).length - 1;
const SOURCE = new URL('../src/', import.meta.url).pathname;
const source = readdirSync(SOURCE, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => readFileSync(join(e.parentPath, e.name), 'latin1')).join('\n');

describe('built app', () => {
  it('has no format reference', () => {
    expect(count('SMW_File_Structure')).toBe(0);
  });
  it('holds the protected marker once', () => {
    expect(count('FeSchVr')).toBe(1);
  });
  it('has no network addresses in its own source', () => {
    expect(source.match(/https?:\/\/[^\s"'`)]+/g) ?? []).toEqual([]);
  });
});
