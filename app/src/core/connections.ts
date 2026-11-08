import type { PinAt, Program } from './types';

/** Stands in for the box of top-level nodes, which have no parent. */
export const ROOT_BOX = 0;

export interface PinKey {
  nodeId: number;
  side: 'in' | 'out';
  index: number;
}
export interface Line {
  boxId: number;
  signalId: number;
  from: PinKey;
  to: PinKey;
}
export interface Tag {
  pin: PinKey;
  signalId: number;
  dir: 'to' | 'from';
  first: number;
  more: number;
}
export interface Connections {
  lines: Line[];
  tagsByNode: Map<number, Tag[]>;
  linesByBox: Map<number, Line[]>;
}

const keyOf = (p: PinAt): PinKey => ({ nodeId: p.nodeId, side: p.pin.side, index: p.pin.index });

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Boxes holding the given pins, distinct and in first-seen (pre-order) order. */
function boxesOf(pins: PinAt[], boxOf: (p: PinAt) => number): number[] {
  return [...new Set(pins.map(boxOf))];
}

export function computeConnections(p: Program): Connections {
  const lines: Line[] = [];
  const tagsByNode = new Map<number, Tag[]>();
  const linesByBox = new Map<number, Line[]>();
  const boxOf = (x: PinAt) => p.nodes.get(x.nodeId)!.parent ?? ROOT_BOX;

  for (const [signalId, pins] of p.signalPins) {
    const outs = pins.filter((x) => x.pin.side === 'out');
    const ins = pins.filter((x) => x.pin.side === 'in');
    const outBoxes = boxesOf(outs, boxOf);
    const inBoxes = boxesOf(ins, boxOf);
    const outBoxSet = new Set(outBoxes);
    const inBoxSet = new Set(inBoxes);

    const addTag = (x: PinAt, dir: Tag['dir'], others: number[], otherSet: Set<number>) => {
      const own = boxOf(x);
      const count = others.length - (otherSet.has(own) ? 1 : 0);
      if (count === 0) return;
      const first = others[0] === own ? others[1]! : others[0]!;
      push(tagsByNode, x.nodeId, { pin: keyOf(x), signalId, dir, first, more: count - 1 });
    };

    const firstOutInBox = new Map<number, PinAt>();
    for (const out of outs) {
      if (!firstOutInBox.has(boxOf(out))) firstOutInBox.set(boxOf(out), out);
      addTag(out, 'to', inBoxes, inBoxSet);
    }
    for (const input of ins) {
      addTag(input, 'from', outBoxes, outBoxSet);
      const driver = firstOutInBox.get(boxOf(input));
      if (!driver) continue;
      const line: Line = { boxId: boxOf(input), signalId, from: keyOf(driver), to: keyOf(input) };
      lines.push(line);
      push(linesByBox, line.boxId, line);
    }
  }
  return { lines, tagsByNode, linesByBox };
}

const nameCounts = new WeakMap<Program, Map<string, number>>();

function countOfName(p: Program, name: string): number {
  let counts = nameCounts.get(p);
  if (!counts) {
    counts = new Map();
    for (const n of p.nodes.values()) {
      if (n.children.length || n.kind === 'folder') counts.set(n.name, (counts.get(n.name) ?? 0) + 1);
    }
    nameCounts.set(p, counts);
  }
  return counts.get(name) ?? 0;
}

const PROGRAM_NAME = 'Program';

export function boxLabel(p: Program, boxId: number): string {
  const n = p.nodes.get(boxId);
  if (!n) return PROGRAM_NAME;
  const isUnique = countOfName(p, n.name) <= 1;
  const parent = n.parent === null ? undefined : p.nodes.get(n.parent);
  return isUnique || !parent ? n.name : `${parent.name} / ${n.name}`;
}

export function boxPath(p: Program, boxId: number): string {
  const parts: string[] = [];
  for (let n = p.nodes.get(boxId); n; n = n.parent === null ? undefined : p.nodes.get(n.parent)) {
    parts.unshift(n.name);
  }
  return parts.join(' / ') || PROGRAM_NAME;
}

export function tagText(p: Program, t: Tag): string {
  return `${t.dir} ${boxLabel(p, t.first)}${t.more ? ` +${t.more}` : ''}`;
}
