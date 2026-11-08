import ELK from 'elkjs/lib/elk.bundled.js';
import { ROOT_BOX, type Connections } from './connections';
import type { MapNode, Program } from './types';

export const PIN_PREVIEW = 8;
export const ELK_CHILD_LIMIT = 500;
export const ROW_H = 16;
export const HEADER_H = 24;
export const SYMBOL_W = 360;
const PAD = 16;
const GAP = 24;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Layout = Map<number, Rect>;

interface Size {
  w: number;
  h: number;
}
type Offsets = Map<number, { x: number; y: number }>;

const elk = new ELK();

/** Height of a node's own pin rows, with long lists collapsed. */
export function pinRows(n: MapNode): number {
  const side = (s: 'in' | 'out') => {
    const count = n.pins.filter((p) => p.side === s).length;
    return count > PIN_PREVIEW ? PIN_PREVIEW + 1 : count;
  };
  return Math.max(side('in'), side('out'));
}

function shelf(ids: number[], sizes: Map<number, Size>): { at: Offsets; size: Size } {
  const area = ids.reduce((a, id) => a + (sizes.get(id)!.w + GAP) * (sizes.get(id)!.h + GAP), 0);
  let widest = 0;
  for (const id of ids) widest = Math.max(widest, sizes.get(id)!.w);
  const limit = Math.max(widest, Math.sqrt(area * 1.5));
  const at: Offsets = new Map();
  let x = 0;
  let y = 0;
  let rowH = 0;
  let w = 0;
  for (const id of ids) {
    const s = sizes.get(id)!;
    if (x > 0 && x + s.w > limit) {
      x = 0;
      y += rowH + GAP;
      rowH = 0;
    }
    at.set(id, { x, y });
    x += s.w + GAP;
    rowH = Math.max(rowH, s.h);
    w = Math.max(w, x - GAP);
  }
  return { at, size: { w, h: y + rowH } };
}

async function arrange(ids: number[], sizes: Map<number, Size>, boxId: number, c: Connections) {
  const inside = new Set(ids);
  const seen = new Set<string>();
  const edges = (c.linesByBox.get(boxId) ?? []).flatMap((l) => {
    const key = `${l.from.nodeId}>${l.to.nodeId}`;
    if (l.from.nodeId === l.to.nodeId || seen.has(key)) return [];
    if (!inside.has(l.from.nodeId) || !inside.has(l.to.nodeId)) return [];
    seen.add(key);
    return [{ id: key, sources: [String(l.from.nodeId)], targets: [String(l.to.nodeId)] }];
  });
  if (!edges.length || ids.length > ELK_CHILD_LIMIT) return shelf(ids, sizes);
  try {
    const g = await elk.layout({
      id: 'box',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': String(GAP),
        'elk.layered.spacing.nodeNodeBetweenLayers': '64',
        'elk.padding': '[top=0,left=0,bottom=0,right=0]',
      },
      children: ids.map((id) => ({ id: String(id), width: sizes.get(id)!.w, height: sizes.get(id)!.h })),
      edges,
    });
    const at: Offsets = new Map();
    let w = 0;
    let h = 0;
    for (const n of g.children ?? []) {
      at.set(Number(n.id), { x: n.x!, y: n.y! });
      w = Math.max(w, n.x! + n.width!);
      h = Math.max(h, n.y! + n.height!);
    }
    return { at, size: { w, h } };
  } catch {
    return shelf(ids, sizes);
  }
}

export async function layoutProgram(
  p: Program,
  c: Connections,
  onProgress?: (done: number, total: number) => void,
): Promise<Layout> {
  const sizes = new Map<number, Size>();
  const offsets: Offsets = new Map();
  const childOrigin = new Map<number, number>();
  const total = p.order.length + 1;
  let done = 0;

  for (let i = p.order.length - 1; i >= 0; i--) {
    const n = p.nodes.get(p.order[i]!)!;
    const pinsH = HEADER_H + pinRows(n) * ROW_H;
    if (!n.children.length) {
      sizes.set(n.id, { w: SYMBOL_W, h: pinsH + 4 });
    } else {
      const { at, size } = await arrange(n.children, sizes, n.id, c);
      at.forEach((v, k) => offsets.set(k, v));
      const top = pinsH + PAD / 2;
      childOrigin.set(n.id, top);
      sizes.set(n.id, { w: Math.max(SYMBOL_W, size.w + PAD * 2), h: top + size.h + PAD });
    }
    onProgress?.(++done, total);
  }

  const rootArrangement = await arrange(p.roots, sizes, ROOT_BOX, c);
  rootArrangement.at.forEach((v, k) => offsets.set(k, v));
  onProgress?.(++done, total);

  const layout: Layout = new Map();
  for (const id of p.order) {
    const n = p.nodes.get(id)!;
    const own = offsets.get(id)!;
    const parent = n.parent === null ? null : layout.get(n.parent)!;
    const x = parent ? parent.x + PAD + own.x : own.x;
    const y = parent ? parent.y + childOrigin.get(n.parent!)! + own.y : own.y;
    layout.set(id, { x, y, ...sizes.get(id)! });
  }
  return layout;
}
