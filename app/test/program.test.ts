import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify } from '../src/core/blocks';
import { label } from '../src/core/labels';
import { buildProgram, isBox } from '../src/core/program';
import type { RawBlock } from '../src/core/types';

type O = Record<string, string | number>;
const b = (o: O): RawBlock => new Map(Object.entries(o).map(([k, v]) => [k, String(v)]));
const sm = (o: O) => b({ ObjTp: 'Sm', ...o });
const sg = (o: O) => b({ ObjTp: 'Sg', ...o });
const build = (...x: RawBlock[]) => buildProgram(x, 'f.smw');

describe('kinds', () => {
  it.each([
    [{ SmC: 156 }, 'folder'],
    [{ SmC: 157 }, 'folder'],
    [{ SmC: 155 }, 'macro'],
    [{ SmC: 103 }, 'simplplus'],
    [{ SmC: 20, DvH: 7 }, 'device'],
    [{ SmC: 20 }, 'logic'],
  ])('%j is %s', (o, kind) => {
    expect(build(sm({ H: 10, ...o })).nodes.get(10)!.kind).toBe(kind);
  });
});

describe('names', () => {
  it('uses Cmn1 for a folder without Nm', () => {
    expect(build(sm({ H: 10, SmC: 156, Cmn1: 'Rack' })).nodes.get(10)!.name).toBe('Rack');
  });
  it('uses Nm', () => {
    expect(build(sm({ H: 10, SmC: 20, Nm: 'Buffer' })).nodes.get(10)!.name).toBe('Buffer');
  });
  it('falls back to the raw code when untabled', () => {
    expect(build(sm({ H: 10, SmC: 99999 })).nodes.get(10)!.name).toBe('99999');
    expect(label('99999')).toBe('99999');
  });
});

describe('pins and signals', () => {
  const p = (o: O) => build(sg({ H: 4, Nm: 's' }), sm({ H: 10, SmC: 20, ...o })).nodes.get(10)!.pins;
  it('links a pin to its signal', () => {
    expect(p({ I1: 4 })[0]).toEqual({ side: 'in', index: 1, signalId: 4, constant: null });
  });
  it.each([[1, '0'], [2, '1'], [3, 'local']])('constant %i', (v, c) => {
    expect(p({ I1: v })[0]).toEqual({ side: 'in', index: 1, signalId: null, constant: c });
  });
  it('leaves an unknown signal unlinked', () => {
    expect(p({ O1: 77 })[0]).toEqual({ side: 'out', index: 1, signalId: null, constant: null });
  });
  it('orders pins numerically', () => {
    expect(p({ I10: 4, I2: 4 }).map((x) => x.index)).toEqual([2, 10]);
  });
  it.each([[undefined, 'digital'], [2, 'analog'], [4, 'serial']])('SgTp %s is %s', (t, k) => {
    const o: O = { H: 4, Nm: 's' };
    if (t !== undefined) o.SgTp = t;
    expect(build(sg(o)).signals.get(4)!.kind).toBe(k);
  });
  it('marks OpF=0 disabled', () => {
    expect(build(sm({ H: 10, SmC: 20, OpF: 0 })).nodes.get(10)!.disabled).toBe(true);
  });
  it('indexes the pins of a signal', () => {
    const r = build(sg({ H: 4, Nm: 's' }), sm({ H: 10, SmC: 20, I1: 4 }), sm({ H: 11, SmC: 20, O1: 4 }));
    expect(r.signalPins.get(4)!.map((x) => x.nodeId)).toEqual([10, 11]);
  });
});

describe('tree', () => {
  it('orders children by C# then appends PrH-only children', () => {
    const r = build(sm({ H: 1, SmC: 157, C1: 12, C2: 11 }), sm({ H: 11, SmC: 20, PrH: 1 }), sm({ H: 12, SmC: 20, PrH: 1 }), sm({ H: 13, SmC: 20, PrH: 1 }));
    expect(r.nodes.get(1)!.children).toEqual([12, 11, 13]);
    expect(isBox(r.nodes.get(1)!)).toBe(true);
    expect(r.order).toEqual([1, 12, 11, 13]);
  });
  it('survives a cycle with each node once', () => {
    const r = build(sm({ H: 20, SmC: 20, PrH: 21 }), sm({ H: 21, SmC: 20, PrH: 20 }));
    expect([...r.order].sort()).toEqual([20, 21]);
    expect([...r.roots].sort()).toEqual([20, 21]);
  });
  it('makes a dangling parent a root', () => {
    const r = build(sm({ H: 20, SmC: 20, PrH: 999 }));
    expect(r.roots).toEqual([20]);
    expect(r.order).toEqual([20]);
    expect(r.nodes.get(20)!.parent).toBeNull();
  });
  it('gives a doubly listed child only to the parent named by its PrH', () => {
    const r = build(sm({ H: 1, SmC: 157, C1: 9 }), sm({ H: 2, SmC: 157, C1: 9 }), sm({ H: 9, SmC: 20, PrH: 2 }));
    expect(r.nodes.get(1)!.children).toEqual([]);
    expect(r.nodes.get(2)!.children).toEqual([9]);
    expect(r.order.filter((x) => x === 9)).toHaveLength(1);
  });
});

it('title prefers the system name then the file name', () => {
  expect(build(b({ ObjTp: 'Hd', CltNm: 'Room' })).title).toBe('Room');
  expect(build().title).toBe('f.smw');
});

it('reads example.smw', () => {
  const r = classify(readFileSync(new URL('../../example.smw', import.meta.url)));
  if (r.status !== 'ok') throw new Error(r.status);
  const p = buildProgram(r.blocks, 'example.smw');
  expect(p.nodes.size).toBe(135);
  expect(p.signals.size).toBe(105);
  expect([...p.nodes.values()].every((n) => n.name !== '')).toBe(true);
});

it('uses only the first line of a folder caption', () => {
  expect(build(sm({ H: 10, SmC: 156, Cmn1: 'Rack||1more' })).nodes.get(10)!.name).toBe('Rack');
});
