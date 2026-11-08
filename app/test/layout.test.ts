import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify } from '../src/core/blocks';
import { computeConnections } from '../src/core/connections';
import { layoutProgram, PIN_PREVIEW, ROW_H, type Layout, type Rect } from '../src/core/layout';
import { chooseOverviewDepth } from '../src/core/overview';
import { buildProgram } from '../src/core/program';
import type { Program } from '../src/core/types';
import { folder, prog, sm } from './helpers';

function load(path: string): Program {
  const r = classify(readFileSync(new URL(path, import.meta.url)));
  if (r.status !== 'ok') throw new Error(r.status);
  return buildProgram(r.blocks, 'x');
}
const lay = (p: Program, cb?: (d: number, t: number) => void) => layoutProgram(p, computeConnections(p), cb);
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function checkGeometry(p: Program, l: Layout) {
  expect(l.size).toBe(p.nodes.size);
  for (const n of p.nodes.values()) {
    const r = l.get(n.id)!;
    const kids = n.children.map((c) => l.get(c)!);
    for (const k of kids) {
      expect(k.x).toBeGreaterThanOrEqual(r.x);
      expect(k.y).toBeGreaterThanOrEqual(r.y);
      expect(k.x + k.w).toBeLessThanOrEqual(r.x + r.w + 0.001);
      expect(k.y + k.h).toBeLessThanOrEqual(r.y + r.h + 0.001);
    }
    if (kids.length < 300) {
      kids.forEach((a, i) => kids.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    }
  }
}

describe('layoutProgram', () => {
  it('places every node of example.smw', async () => checkGeometry(load('../../example.smw'), await lay(load('../../example.smw'))), 30000);
  it('places every node of the median fixture', async () => {
    const p = load('./fixtures/median.smw');
    checkGeometry(p, await lay(p));
  }, 60000);
  it('bases symbol height on at most the preview rows', async () => {
    const pins = (c: number) => Object.fromEntries(Array.from({ length: c }, (_, i) => [`I${i + 1}`, 1]));
    const p = prog(sm({ H: 10, ...pins(PIN_PREVIEW) }), sm({ H: 11, ...pins(100) }));
    const l = await lay(p);
    expect(l.get(11)!.h - l.get(10)!.h).toBeLessThanOrEqual(ROW_H);
  });
  it('is repeatable', async () => {
    const p = load('../../example.smw');
    expect([...(await lay(p))]).toEqual([...(await lay(p))]);
  }, 30000);
  it('uses a grid for a very wide box', async () => {
    const kids = Array.from({ length: 600 }, (_, i) => sm({ H: 10 + i, PrH: 1 }));
    const p = prog(folder(1, 'A'), ...kids);
    const l = await lay(p);
    checkGeometry(p, l);
    const rects = p.nodes.get(1)!.children.map((c) => l.get(c)!);
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    expect(l.get(1)!.w).toBeLessThan(l.get(1)!.h * 4);
  });
  it('reports progress to the total', async () => {
    const seen: [number, number][] = [];
    await lay(prog(folder(1, 'A'), sm({ H: 10, PrH: 1 })), (d, t) => seen.push([d, t]));
    expect(seen.at(-1)![0]).toBe(seen.at(-1)![1]);
  });
});

describe('chooseOverviewDepth', () => {
  const p = prog(folder(1, 'A'), folder(2, 'B', 1), sm({ H: 10, PrH: 2 }));
  it('stops at depth 1 when depth-2 boxes would be too narrow', () => {
    const l: Layout = new Map([[1, { x: 0, y: 0, w: 100000, h: 100 }], [2, { x: 0, y: 0, w: 500, h: 50 }], [10, { x: 0, y: 0, w: 10, h: 10 }]]);
    expect(chooseOverviewDepth(p, l)).toBe(1);
  });
  it('goes deeper for a small program', () => {
    const l: Layout = new Map([[1, { x: 0, y: 0, w: 1000, h: 500 }], [2, { x: 0, y: 0, w: 500, h: 50 }], [10, { x: 0, y: 0, w: 10, h: 10 }]]);
    expect(chooseOverviewDepth(p, l)).toBe(2);
  });
  it('never returns less than 1', () => {
    expect(chooseOverviewDepth(prog(), new Map())).toBe(1);
  });
});
