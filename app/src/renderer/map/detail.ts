import { tagText, type Tag } from '../../core/connections';
import { PIN_PREVIEW, type Layout, type Rect } from '../../core/layout';
import type { MapNode, Program } from '../../core/types';

export type Detail = 'hidden' | 'box' | 'block' | 'full';
export const TAG_COLLAPSE = 8;

export function detailFor(screenWidthPx: number): Detail {
  if (screenWidthPx < 4) return 'hidden';
  if (screenWidthPx < 70) return 'box';
  if (screenWidthPx < 230) return 'block';
  return 'full';
}

const touches = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function visibleNodes(p: Program, l: Layout, view: Rect, minWidth = 0): number[] {
  const out: number[] = [];
  const stack = [...p.roots].reverse();
  while (stack.length) {
    const id = stack.pop()!;
    const r = l.get(id)!;
    if (r.w < minWidth || !touches(r, view)) continue;
    out.push(id);
    const kids = p.nodes.get(id)!.children;
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
  }
  return out;
}

const pinPositions = new WeakMap<MapNode, Map<string, number>>();

export function rowOfPin(n: MapNode, side: 'in' | 'out', index: number): number {
  let positions = pinPositions.get(n);
  if (!positions) {
    const next = { in: 0, out: 0 };
    positions = new Map(n.pins.map((x) => [`${x.side}${x.index}`, next[x.side]++]));
    pinPositions.set(n, positions);
  }
  return Math.min(positions.get(`${side}${index}`) ?? 0, PIN_PREVIEW);
}

export function tagDisplay(p: Program, t: Tag): string {
  if (t.more >= TAG_COLLAPSE) return `${t.dir} ${t.more + 1} places`;
  return tagText(p, t);
}

export function nodeTitle(n: Pick<MapNode, 'name' | 'typeCode' | 'typeLabel'>): string {
  return n.typeLabel === n.typeCode || n.typeLabel === n.name ? n.name : `${n.name} (${n.typeLabel})`;
}
