import { describe, expect, it } from 'vitest';
import { boxLabel, boxPath, computeConnections, tagText } from '../src/core/connections';
import { folder, prog, sg, sm } from './helpers';

const tags = (c: ReturnType<typeof computeConnections>, id: number) => c.tagsByNode.get(id) ?? [];

describe('computeConnections', () => {
  it('joins siblings with one line and no tags', () => {
    const c = computeConnections(prog(folder(1, 'A'), sg(4), sm({ H: 10, PrH: 1, O1: 4 }), sm({ H: 11, PrH: 1, I1: 4 })));
    expect(c.lines).toEqual([{ boxId: 1, signalId: 4, from: { nodeId: 10, side: 'out', index: 1 }, to: { nodeId: 11, side: 'in', index: 1 } }]);
    expect(c.linesByBox.get(1)).toHaveLength(1);
    expect(c.tagsByNode.size).toBe(0);
  });
  it('tags both ends across boxes', () => {
    const c = computeConnections(prog(folder(1, 'A'), folder(2, 'B'), sg(4), sm({ H: 10, PrH: 1, O1: 4 }), sm({ H: 11, PrH: 2, I1: 4 })));
    expect(c.lines).toEqual([]);
    expect(tags(c, 10)).toMatchObject([{ dir: 'to', first: 2, more: 0, signalId: 4 }]);
    expect(tags(c, 11)).toMatchObject([{ dir: 'from', first: 1, more: 0 }]);
  });
  it('gives an output feeding local and remote boxes lines and one tag', () => {
    const c = computeConnections(prog(folder(1, 'A'), folder(2, 'B'), folder(3, 'C'), sg(4),
      sm({ H: 10, PrH: 1, O1: 4 }), sm({ H: 11, PrH: 1, I1: 4 }), sm({ H: 12, PrH: 2, I1: 4 }), sm({ H: 13, PrH: 3, I1: 4 })));
    expect(c.lines).toHaveLength(1);
    expect(tags(c, 10)).toMatchObject([{ first: 2, more: 1 }]);
  });
  it('tags a connection into a nested subfolder', () => {
    const c = computeConnections(prog(folder(1, 'A'), folder(2, 'B', 1), sg(4), sm({ H: 10, PrH: 1, O1: 4 }), sm({ H: 11, PrH: 2, I1: 4 })));
    expect(c.lines).toEqual([]);
    expect(tags(c, 10)).toHaveLength(1);
  });
  it('draws a single line from the first of several drivers', () => {
    const c = computeConnections(prog(folder(1, 'A'), sg(4), sm({ H: 10, PrH: 1, O1: 4 }), sm({ H: 11, PrH: 1, O1: 4 }), sm({ H: 12, PrH: 1, I1: 4 })));
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0]!.from.nodeId).toBe(10);
  });
  it('connects inputs with no driver to nothing', () => {
    const c = computeConnections(prog(folder(1, 'A'), folder(2, 'B'), sg(4), sm({ H: 10, PrH: 1, I1: 4 }), sm({ H: 11, PrH: 2, I1: 4 })));
    expect(c.lines).toEqual([]);
    expect(c.tagsByNode.size).toBe(0);
  });
  it('never connects constants', () => {
    const syms = Array.from({ length: 100 }, (_, i) => sm({ H: 10 + i, I1: 1 + (i % 3) }));
    const c = computeConnections(prog(...syms));
    expect(c.lines).toEqual([]);
    expect(c.tagsByNode.size).toBe(0);
  });
  it('picks the first other box in pre-order', () => {
    const c = computeConnections(prog(folder(2, 'B'), folder(1, 'A'), sg(4), sm({ H: 10, PrH: 1, O1: 4 }), sm({ H: 11, PrH: 2, I1: 4 }), sm({ H: 12, PrH: 1, I1: 4 })));
    expect(tags(c, 10)[0]!.first).toBe(2);
  });
  it('uses the parent of a device for its own pins', () => {
    const c = computeConnections(prog(folder(1, 'A'), sg(4), sm({ H: 10, PrH: 1, DvH: 5, O1: 4 }), sm({ H: 11, PrH: 10, I1: 4 })));
    expect(tags(c, 10)).toMatchObject([{ dir: 'to', first: 10 }]);
    expect(tags(c, 11)).toMatchObject([{ dir: 'from', first: 1 }]);
  });
});

describe('text', () => {
  const p = prog(folder(1, 'A'), folder(2, 'Sources', 1), folder(3, 'B'), folder(4, 'Sources', 3), folder(5, 'Solo'));
  it('adds the parent when a name is not unique', () => {
    expect(boxLabel(p, 5)).toBe('Solo');
    expect(boxLabel(p, 2)).toBe('A / Sources');
  });
  it('gives the full path', () => {
    expect(boxPath(p, 4)).toBe('B / Sources');
  });
  it('words tags exactly', () => {
    const q = prog(folder(5, 'Sources'));
    const pin = { nodeId: 1, side: 'out' as const, index: 1 };
    expect(tagText(q, { pin, signalId: 4, dir: 'to', first: 5, more: 0 })).toBe('to Sources');
    expect(tagText(q, { pin, signalId: 4, dir: 'from', first: 5, more: 2 })).toBe('from Sources +2');
  });
});
