import table from './labels.json';

const labels: Record<string, string> = table;

export function label(code: string): string {
  return labels[code] ?? code;
}
