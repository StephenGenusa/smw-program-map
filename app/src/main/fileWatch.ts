import { statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';

export interface Stamp {
  size: number;
  mtimeMs: number;
}

const same = (a: Stamp | null, b: Stamp | null) => a?.size === b?.size && a?.mtimeMs === b?.mtimeMs;

/** Reports a change once a new size and time have held for two polls, so a half-written file is never read. */
export class ChangeDetector {
  private pending: Stamp | null = null;

  constructor(private baseline: Stamp | null) {}

  observe(now: Stamp | null): boolean {
    if (now === null || same(now, this.baseline)) {
      this.pending = null;
      return false;
    }
    if (!same(now, this.pending)) {
      this.pending = now;
      return false;
    }
    this.baseline = now;
    this.pending = null;
    return true;
  }

  /** Makes the current state count as a change again, for when reading it failed. */
  forget(): void {
    this.baseline = null;
    this.pending = null;
  }
}

function toStamp(s: { size: number; mtimeMs: number }): Stamp {
  return { size: s.size, mtimeMs: s.mtimeMs };
}

function initialStamp(path: string): Stamp | null {
  try {
    return toStamp(statSync(path));
  } catch {
    return null;
  }
}

export interface WatchOptions {
  intervalMs?: number;
  read?: (path: string) => Promise<Uint8Array>;
}

/**
 * Polls one file and delivers its bytes after each change. Polling, rather than
 * fs.watch, behaves the same on every OS and also sees network shares and
 * saves that replace the file. Returns a function that stops watching.
 */
export function watchFile(path: string, onChange: (bytes: Uint8Array) => void, options: WatchOptions = {}): () => void {
  const { intervalMs = 1000, read = readFile } = options;
  const detector = new ChangeDetector(initialStamp(path));
  let busy = false;
  let stopped = false;

  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const now = await stat(path).then(toStamp, () => null);
      if (stopped || !detector.observe(now)) return;
      const bytes = await read(path);
      if (!stopped) onChange(new Uint8Array(bytes));
    } catch {
      detector.forget();
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void poll(), intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
