import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeDetector, watchFile } from '../src/main/fileWatch';

const A = { size: 10, mtimeMs: 100 };
const B = { size: 20, mtimeMs: 200 };
const C = { size: 30, mtimeMs: 300 };

describe('ChangeDetector', () => {
  it('reports nothing while the file is unchanged', () => {
    const d = new ChangeDetector(A);
    expect([d.observe(A), d.observe(A), d.observe(A)]).toEqual([false, false, false]);
  });
  it('reports a change only once it has held still for two polls', () => {
    const d = new ChangeDetector(A);
    expect([d.observe(B), d.observe(B), d.observe(B)]).toEqual([false, true, false]);
  });
  it('waits while the file is still being written', () => {
    const d = new ChangeDetector(A);
    expect([d.observe(B), d.observe(C), d.observe(C)]).toEqual([false, false, true]);
  });
  it('rides out the file briefly missing during a save', () => {
    const d = new ChangeDetector(A);
    expect([d.observe(null), d.observe(B), d.observe(B)]).toEqual([false, false, true]);
  });
  it('ignores a file restored exactly as it was', () => {
    const d = new ChangeDetector(A);
    expect([d.observe(B), d.observe(A), d.observe(A)]).toEqual([false, false, false]);
  });
  it('reports the same change again after forget', () => {
    const d = new ChangeDetector(A);
    d.observe(B);
    d.observe(B);
    d.forget();
    expect([d.observe(B), d.observe(B)]).toEqual([false, true]);
  });
});

describe('watchFile', () => {
  let dir: string;
  let file: string;
  let stop: () => void = () => {};
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smw-watch-'));
    file = join(dir, 'a.smw');
    writeFileSync(file, 'one');
  });
  afterEach(() => {
    stop();
    rmSync(dir, { recursive: true, force: true });
  });
  const text = (b: Uint8Array) => Buffer.from(b).toString();

  it('delivers the new contents after an in-place save', async () => {
    const seen = vi.fn<(b: Uint8Array) => void>();
    stop = watchFile(file, seen, { intervalMs: 10 });
    writeFileSync(file, 'two!');
    await vi.waitFor(() => expect(seen).toHaveBeenCalledOnce());
    expect(text(seen.mock.calls[0]![0])).toBe('two!');
  });
  it('follows a save that replaces the file by rename', async () => {
    const seen = vi.fn<(b: Uint8Array) => void>();
    stop = watchFile(file, seen, { intervalMs: 10 });
    const temp = join(dir, 'a.tmp');
    writeFileSync(temp, 'replaced');
    renameSync(temp, file);
    await vi.waitFor(() => expect(seen).toHaveBeenCalledOnce());
    expect(text(seen.mock.calls[0]![0])).toBe('replaced');
  });
  it('stays quiet when nothing changes', async () => {
    const seen = vi.fn();
    stop = watchFile(file, seen, { intervalMs: 5 });
    await new Promise((r) => setTimeout(r, 60));
    expect(seen).not.toHaveBeenCalled();
  });
  it('stops delivering after stop', async () => {
    const seen = vi.fn();
    watchFile(file, seen, { intervalMs: 5 })();
    writeFileSync(file, 'two!');
    await new Promise((r) => setTimeout(r, 60));
    expect(seen).not.toHaveBeenCalled();
  });
  it('retries when the file is locked at read time', async () => {
    const seen = vi.fn<(b: Uint8Array) => void>();
    const read = vi.fn<(p: string) => Promise<Uint8Array>>()
      .mockRejectedValueOnce(new Error('EBUSY'))
      .mockResolvedValue(new TextEncoder().encode('after'));
    stop = watchFile(file, seen, { intervalMs: 5, read });
    writeFileSync(file, 'two!');
    await vi.waitFor(() => expect(seen).toHaveBeenCalledOnce());
    expect(read).toHaveBeenCalledTimes(2);
    expect(text(seen.mock.calls[0]![0])).toBe('after');
  });
});
