import { label } from './labels';
import type { MapNode, NodeKind, Pin, PinAt, Program, RawBlock, Signal, SignalKind } from './types';

const PIN_KEY = /^([IO])([0-9]+)$/;
const CHILD_KEY = /^C([0-9]+)$/;
const CONSTANTS = new Map<string, Pin['constant']>([['1', '0'], ['2', '1'], ['3', 'local']]);
const SIGNAL_KINDS = new Map<string, SignalKind>([['2', 'analog'], ['4', 'serial']]);

export const isBox = (n: MapNode): boolean => n.children.length > 0;

function kindOf(b: RawBlock): NodeKind {
  const code = b.get('SmC');
  if (code === '156' || code === '157') return 'folder';
  if (code === '155') return 'macro';
  if (code === '103') return 'simplplus';
  return b.has('DvH') ? 'device' : 'logic';
}

function nameOf(b: RawBlock, kind: NodeKind, code: string, id: number): string {
  const caption = kind === 'folder' ? (b.get('Cmn1') ?? '').split('||')[0]!.replace(/\\+$/, '') : '';
  return caption || b.get('Nm') || label(code) || String(id);
}

function pinsOf(b: RawBlock, signals: Map<number, Signal>): Pin[] {
  const pins: Pin[] = [];
  for (const [key, value] of b) {
    const m = PIN_KEY.exec(key);
    if (!m) continue;
    const id = Number(value);
    const constant = CONSTANTS.get(value) ?? null;
    pins.push({
      side: m[1] === 'I' ? 'in' : 'out',
      index: Number(m[2]),
      signalId: !constant && signals.has(id) ? id : null,
      constant,
    });
  }
  return pins.sort((a, b2) => (a.side === b2.side ? a.index - b2.index : a.side === 'in' ? -1 : 1));
}

function listedChildren(b: RawBlock): number[] {
  const out: [number, number][] = [];
  for (const [key, value] of b) {
    const m = CHILD_KEY.exec(key);
    if (m) out.push([Number(m[1]), Number(value)]);
  }
  return out.sort((x, y) => x[0] - y[0]).map((x) => x[1]);
}

/** Detaches every node on a parent cycle, so the tree walk reaches all nodes. */
function breakCycles(nodes: Map<number, MapNode>): void {
  const done = new Set<number>();
  for (const start of nodes.keys()) {
    const path: number[] = [];
    const onPath = new Set<number>();
    let id: number | null = start;
    while (id !== null && !done.has(id) && !onPath.has(id)) {
      path.push(id);
      onPath.add(id);
      id = nodes.get(id)!.parent;
    }
    if (id !== null && onPath.has(id)) {
      for (const member of path.slice(path.indexOf(id))) nodes.get(member)!.parent = null;
    }
    path.forEach((p) => done.add(p));
  }
}

export function buildProgram(blocks: RawBlock[], fileName: string): Program {
  const signals = new Map<number, Signal>();
  for (const b of blocks) {
    if (b.get('ObjTp') !== 'Sg' || !b.has('H')) continue;
    const id = Number(b.get('H'));
    signals.set(id, { id, name: b.get('Nm') || String(id), kind: SIGNAL_KINDS.get(b.get('SgTp') ?? '') ?? 'digital' });
  }

  const raw = new Map<number, RawBlock>();
  const nodes = new Map<number, MapNode>();
  for (const b of blocks) {
    if (b.get('ObjTp') !== 'Sm' || !b.has('H')) continue;
    const id = Number(b.get('H'));
    const typeCode = b.get('SmC') ?? '';
    const kind = kindOf(b);
    raw.set(id, b);
    nodes.set(id, {
      id,
      parent: b.has('PrH') ? Number(b.get('PrH')) : null,
      children: [],
      kind,
      name: nameOf(b, kind, typeCode, id),
      typeCode,
      typeLabel: label(typeCode),
      pins: pinsOf(b, signals),
      disabled: b.get('OpF') === '0',
    });
  }
  for (const n of nodes.values()) {
    if (n.parent === n.id || (n.parent !== null && !nodes.has(n.parent))) n.parent = null;
  }
  breakCycles(nodes);

  for (const [id, b] of raw) {
    const n = nodes.get(id)!;
    n.children = listedChildren(b).filter((c) => nodes.get(c)?.parent === id);
    n.children = [...new Set(n.children)];
  }
  const placed = new Set([...nodes.values()].flatMap((n) => n.children));
  for (const n of nodes.values()) {
    if (n.parent !== null && !placed.has(n.id)) nodes.get(n.parent)!.children.push(n.id);
  }

  const roots = [...nodes.values()].filter((n) => n.parent === null).map((n) => n.id);
  const order: number[] = [];
  const stack = [...roots].reverse();
  while (stack.length) {
    const id = stack.pop()!;
    order.push(id);
    const kids = nodes.get(id)!.children;
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
  }

  const signalPins = new Map<number, PinAt[]>();
  for (const nodeId of order) {
    for (const pin of nodes.get(nodeId)!.pins) {
      if (pin.signalId === null) continue;
      let list = signalPins.get(pin.signalId);
      if (!list) signalPins.set(pin.signalId, (list = []));
      list.push({ nodeId, pin });
    }
  }

  const header = blocks.find((b) => b.get('ObjTp') === 'Hd');
  return { title: header?.get('CltNm') || fileName, nodes, roots, order, signals, signalPins };
}
