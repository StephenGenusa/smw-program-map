import { describe, expect, it } from 'vitest';
import { buildIndex, search } from '../src/core/search';
import type { Program } from '../src/core/types';
import { prog, sg, sm } from './helpers';

const p = prog(sg(4, 'Volume_Up'), sg(5, 'mute_volume'), sm({ H: 10, SmC: 20, Nm: 'Buffer', I1: 1 }), sm({ H: 11, SmC: 20, Nm: 'Other Buffer' }), sm({ H: 12, SmC: 30, Nm: 'AND' }));
const ix = buildIndex(p);

describe('search', () => {
  it('matches case-insensitive substrings', () => {
    expect(search(ix, 'VOLUME').signals.map((s) => s.signalId).sort()).toEqual([4, 5]);
  });
  it('puts names that start with the query first', () => {
    expect(search(ix, 'volume').signals[0]!.signalId).toBe(4);
    expect(search(ix, 'buffer').symbols.map((s) => s.nodeId)).toEqual([10, 11]);
  });
  it('lists every instance of a symbol type', () => {
    const t = search(ix, '20').types;
    expect(t).toHaveLength(1);
    expect(t[0]!.nodeIds).toEqual([10, 11]);
  });
  it('limits each group', () => {
    const q = prog(...Array.from({ length: 80 }, (_, i) => sg(4 + i, `abc${i}`)));
    expect(search(buildIndex(q), 'abc').signals).toHaveLength(50);
    expect(search(buildIndex(q), 'abc', 3).signals).toHaveLength(3);
  });
  it('returns nothing for a blank query', () => {
    expect(search(ix, '   ')).toEqual({ symbols: [], types: [], signals: [] });
  });
  it('treats regex characters literally', () => {
    expect(search(ix, 'a.*[').signals).toEqual([]);
  });
  it('never lists a constant as a signal', () => {
    expect(search(ix, '0').signals).toEqual([]);
  });
  it('searches 250,000 signals in under 100 ms', () => {
    const signals = new Map(Array.from({ length: 250000 }, (_, i) => [i + 4, { id: i + 4, name: `signal_name_${i}`, kind: 'digital' as const }]));
    const big: Program = { title: '', nodes: new Map(), roots: [], order: [], signals, signalPins: new Map() };
    const i = buildIndex(big);
    const t = performance.now();
    search(i, 'name_24999');
    expect(performance.now() - t).toBeLessThan(100);
  });
});
