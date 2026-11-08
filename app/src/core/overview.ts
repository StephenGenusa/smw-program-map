import type { Layout } from './layout';
import type { Program } from './types';

export function chooseOverviewDepth(p: Program, l: Layout, maxPx = 8192, minBoxPx = 120): number {
  let extent = 0;
  for (const r of l.values()) extent = Math.max(extent, r.x + r.w, r.y + r.h);
  if (!extent) return 1;
  const scale = maxPx / extent;

  const narrowest = new Map<number, number>();
  let level = p.roots.filter((id) => p.nodes.get(id)!.children.length);
  for (let depth = 1; level.length; depth++) {
    narrowest.set(depth, Math.min(...level.map((id) => l.get(id)!.w)));
    level = level.flatMap((id) => p.nodes.get(id)!.children).filter((id) => p.nodes.get(id)!.children.length);
  }
  let chosen = 1;
  for (const [depth, w] of narrowest) {
    if (w * scale < minBoxPx) break;
    chosen = depth;
  }
  return chosen;
}
