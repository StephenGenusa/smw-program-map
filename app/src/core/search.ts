import type { Program } from './types';

export interface SearchResults {
  symbols: { nodeId: number; text: string }[];
  types: { typeCode: string; text: string; nodeIds: number[] }[];
  signals: { signalId: number; text: string }[];
}

interface Entry<T> {
  key: string;
  item: T;
}

export interface SearchIndex {
  symbols: Entry<SearchResults['symbols'][number]>[];
  types: Entry<SearchResults['types'][number]>[];
  signals: Entry<SearchResults['signals'][number]>[];
}

/** The name shown most often for a type stands in when the label table has no entry. */
function typeText(names: string[], typeCode: string, typeLabel: string): string {
  if (typeLabel !== typeCode) return typeLabel;
  const counts = new Map<string, number>();
  let best = typeCode;
  for (const n of names) {
    const c = (counts.get(n) ?? 0) + 1;
    counts.set(n, c);
    if (c > (counts.get(best) ?? 0)) best = n;
  }
  return best;
}

export function buildIndex(p: Program): SearchIndex {
  const grouped = new Map<string, { label: string; nodeIds: number[]; names: string[] }>();
  const symbols: SearchIndex['symbols'] = [];
  for (const id of p.order) {
    const n = p.nodes.get(id)!;
    symbols.push({ key: n.name.toLowerCase(), item: { nodeId: id, text: n.name } });
    const g = grouped.get(n.typeCode) ?? { label: n.typeLabel, nodeIds: [], names: [] };
    g.nodeIds.push(id);
    g.names.push(n.name);
    grouped.set(n.typeCode, g);
  }
  const types = [...grouped].map(([typeCode, g]) => {
    const text = typeText(g.names, typeCode, g.label);
    return { key: `${text} ${typeCode}`.toLowerCase(), item: { typeCode, text, nodeIds: g.nodeIds } };
  });
  const signals = [...p.signals.values()].map((s) => ({
    key: s.name.toLowerCase(),
    item: { signalId: s.id, text: s.name },
  }));
  return { symbols, types, signals };
}

function find<T>(entries: Entry<T>[], q: string, limit: number): T[] {
  const starts: T[] = [];
  const contains: T[] = [];
  for (const e of entries) {
    const at = e.key.indexOf(q);
    if (at === 0) {
      if (starts.length < limit) starts.push(e.item);
    } else if (at > 0 && contains.length < limit) {
      contains.push(e.item);
    }
  }
  return [...starts, ...contains].slice(0, limit);
}

export function search(ix: SearchIndex, q: string, limitPerGroup = 50): SearchResults {
  const needle = q.trim().toLowerCase();
  if (!needle) return { symbols: [], types: [], signals: [] };
  return {
    symbols: find(ix.symbols, needle, limitPerGroup),
    types: find(ix.types, needle, limitPerGroup),
    signals: find(ix.signals, needle, limitPerGroup),
  };
}
