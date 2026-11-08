import { describe, expect, it } from 'vitest';
import { highlightedNodes, occurrences } from '../src/renderer/map/highlight';
import { folder, prog, sg, sm } from './helpers';

const p = prog(folder(1, 'A'), sg(4), sm({ H: 10, PrH: 1, O1: 4 }), sm({ H: 11, I1: 4, I2: 4 }));

describe('occurrences', () => {
  it('lists every pin in pre-order', () => {
    expect(occurrences(p, 4).map((o) => [o.nodeId, o.pin.side, o.pin.index])).toEqual([[10, 'out', 1], [11, 'in', 1], [11, 'in', 2]]);
  });
  it('is empty for an unknown signal', () => {
    expect(occurrences(p, 99)).toEqual([]);
  });
});

it('includes ancestors when highlighting nodes', () => {
  expect([...highlightedNodes(p, [10])].sort()).toEqual([1, 10]);
});
