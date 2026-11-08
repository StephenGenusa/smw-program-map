import { describe, expect, it } from 'vitest';
import { computeConnections } from '../src/core/connections';
import { layoutProgram, type Layout } from '../src/core/layout';
import { chooseOverviewDepth } from '../src/core/overview';
import { label } from '../src/core/labels';
import { buildProgram } from '../src/core/program';
import type { MapNode, Program, RawBlock } from '../src/core/types';
import { folder, prog, sg, sm } from './helpers';

const HUGE = 300_000;

describe('values named like Object.prototype members', () => {
  it('leaves a pin holding "constructor" unconnected and not constant', () => {
    const pin = prog(sm({ H: 1, I1: 'constructor' })).nodes.get(1)!.pins[0]!;
    expect(pin.constant).toBeNull();
    expect(pin.signalId).toBeNull();
  });
  it('treats a signal type of "constructor" as digital', () => {
    const block: RawBlock = new Map([['ObjTp', 'Sg'], ['H', '4'], ['Nm', 'x'], ['SgTp', 'constructor']]);
    expect(prog(block).signals.get(4)!.kind).toBe('digital');
  });
  it.each(['constructor', 'toString', '__proto__'])('labels the unknown type code %s as itself', (code) => {
    expect(label(code)).toBe(code);
  });
  it('produces a program the worker can post back', () => {
    const p = prog(sm({ H: 1, SmC: 'constructor', I1: 'toString' }), sg(2));
    expect(() => structuredClone(p)).not.toThrow();
  });
});

describe('very large levels', () => {
  it('chooses an overview depth with one level of 300k boxes', () => {
    const nodes = new Map<number, MapNode>();
    const layout: Layout = new Map();
    const roots: number[] = [];
    for (let i = 0; i < HUGE; i++) {
      const id = i * 2 + 1;
      roots.push(id);
      nodes.set(id, { id, parent: null, children: [id + 1], kind: 'folder', name: 'b', typeCode: '156', typeLabel: 'Folder', pins: [], disabled: false });
      nodes.set(id + 1, { id: id + 1, parent: id, children: [], kind: 'logic', name: 'c', typeCode: '20', typeLabel: '20', pins: [], disabled: false });
      layout.set(id, { x: 0, y: 0, w: 100, h: 100 });
    }
    expect(chooseOverviewDepth({ nodes, roots } as unknown as Program, layout)).toBe(1);
  });
  it('lays out a folder with 300k children', async () => {
    const blocks = [folder(1, 'root')];
    for (let i = 0; i < HUGE; i++) blocks.push(sm({ H: i + 2, PrH: 1 }));
    const p = buildProgram(blocks, 'f.smw');
    const l = await layoutProgram(p, computeConnections(p));
    expect(l.size).toBe(HUGE + 1);
  }, 120_000);
});
