import table from './labels.json';

const labels = new Map<string, string>(Object.entries(table));

export function label(code: string): string {
  return labels.get(code) ?? code;
}
