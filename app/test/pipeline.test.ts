import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runPipeline } from '../src/worker/pipeline';

const fixture = (n: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)));
const text = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

describe('runPipeline', () => {
  it('loads the median fixture and reports each stage', async () => {
    const stages = new Set<string>();
    const r = await runPipeline(fixture('median.smw'), 'median.smw', (s) => stages.add(s));
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.layout.size).toBe(r.program.nodes.size);
      expect(r.connections.lines.length).toBeGreaterThan(0);
    }
    expect([...stages]).toEqual(['parse', 'connect', 'layout']);
  }, 60000);
  it('reports a protected file', async () => {
    expect(await runPipeline(fixture('protected.umc'), 'p.umc', () => {})).toEqual({ status: 'protected', name: 'protected_sample' });
  });
  it('reports junk as unreadable', async () => {
    expect(await runPipeline(Uint8Array.from([0, 255, 1]), 'j.smw', () => {})).toEqual({ status: 'unreadable' });
  });
  it('loads a symbol missing every optional key', async () => {
    const r = await runPipeline(text('[\nObjTp=Sm\nH=9\n]\n'), 'm.smw', () => {});
    expect(r.status).toBe('ok');
  });
});
