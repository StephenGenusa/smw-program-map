import type { PinAt, Program } from '../../core/types';

export type Occurrence = PinAt;

export function occurrences(p: Program, signalId: number): Occurrence[] {
  return p.signalPins.get(signalId) ?? [];
}

export function highlightedNodes(p: Program, ids: Iterable<number>): Set<number> {
  const out = new Set<number>();
  for (const id of ids) {
    for (let n = p.nodes.get(id); n && !out.has(n.id); n = n.parent === null ? undefined : p.nodes.get(n.parent)) {
      out.add(n.id);
    }
  }
  return out;
}
