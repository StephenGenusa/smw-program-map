import { HEADER_H, ROW_H, type Layout } from '../../core/layout';
import type { PinKey } from '../../core/connections';
import type { Program } from '../../core/types';
import { rowOfPin } from './detail';
import type { Scene } from './scene';
import { sx, sy, type Transform } from './view';

export interface Point {
  x: number;
  y: number;
}

export function pinPoint(p: Program, l: Layout, key: PinKey, t: Transform): Point {
  const r = l.get(key.nodeId)!;
  const row = rowOfPin(p.nodes.get(key.nodeId)!, key.side, key.index);
  return {
    x: sx(t, key.side === 'in' ? r.x : r.x + r.w),
    y: sy(t, r.y + HEADER_H + (row + 0.5) * ROW_H),
  };
}

export function curve(s: Scene, a: Point, b: Point, color: number, width: number, alpha: number): void {
  const bend = Math.max(24, Math.abs(b.x - a.x) / 2);
  s.links.moveTo(a.x, a.y).bezierCurveTo(a.x + bend, a.y, b.x - bend, b.y, b.x, b.y).stroke({ color, width, alpha });
}
