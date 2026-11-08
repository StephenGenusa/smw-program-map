import { describe, expect, it } from 'vitest';
import { detailFor, nodeTitle, rowOfPin, tagDisplay, TAG_COLLAPSE, visibleNodes } from '../src/renderer/map/detail';
import { PIN_PREVIEW, type Layout } from '../src/core/layout';
import { folder, prog, sg, sm } from './helpers';

describe('detailFor', () => {
  it('rises in order with width', () => {
    const rank = ['hidden', 'box', 'block', 'full'];
    const seen = [1, 20, 100, 1000].map((w) => rank.indexOf(detailFor(w)));
    expect(seen).toEqual([0, 1, 2, 3]);
  });
});

describe('visibleNodes', () => {
  const p = prog(folder(1, 'A'), sm({ H: 10, PrH: 1 }), folder(2, 'B'), sm({ H: 11, PrH: 2 }));
  const l: Layout = new Map([
    [1, { x: 0, y: 0, w: 100, h: 100 }], [10, { x: 10, y: 10, w: 20, h: 20 }],
    [2, { x: 500, y: 0, w: 100, h: 100 }], [11, { x: 510, y: 10, w: 20, h: 20 }],
  ]);
  it('skips the children of an off-screen box', () => {
    expect(visibleNodes(p, l, { x: 0, y: 0, w: 200, h: 200 })).toEqual([1, 10]);
  });
  it('includes partially visible nodes', () => {
    expect(visibleNodes(p, l, { x: 550, y: 50, w: 200, h: 200 })).toEqual([2]);
    expect(visibleNodes(p, l, { x: 95, y: 0, w: 10, h: 10 })).toEqual([1]);
  });
  it('can prune nodes too small to draw', () => {
    expect(visibleNodes(p, l, { x: 0, y: 0, w: 200, h: 200 }, 50)).toEqual([1]);
  });
});

describe('rowOfPin', () => {
  const pins = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`I${i + 1}`, 4]));
  const n = prog(sg(4), sm({ H: 10, ...pins, O3: 4 })).nodes.get(10)!;
  it('uses position within the side', () => {
    expect(rowOfPin(n, 'in', 2)).toBe(1);
    expect(rowOfPin(n, 'out', 3)).toBe(0);
  });
  it('folds a pin past the preview onto the more row', () => {
    expect(rowOfPin(n, 'in', 12)).toBe(PIN_PREVIEW);
  });
});

describe('tagDisplay', () => {
  const p = prog(folder(1, 'Sources'));
  const pin = { nodeId: 9, side: 'out' as const, index: 1 };
  it('shows the normal text for a few places', () => {
    expect(tagDisplay(p, { pin, signalId: 4, dir: 'to', first: 1, more: 1 })).toBe('to Sources +1');
  });
  it('collapses many places to a count', () => {
    expect(tagDisplay(p, { pin, signalId: 4, dir: 'from', first: 1, more: TAG_COLLAPSE })).toBe(`from ${TAG_COLLAPSE + 1} places`);
  });
});

describe('nodeTitle', () => {
  it('omits a type that has no label', () => {
    expect(nodeTitle({ name: 'DM-MD8x8', typeCode: '1899', typeLabel: '1899' })).toBe('DM-MD8x8');
  });
  it('adds a labelled type', () => {
    expect(nodeTitle({ name: 'x.umc', typeCode: '155', typeLabel: 'Macro' })).toBe('x.umc (Macro)');
  });
});
