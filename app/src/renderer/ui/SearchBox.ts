import { search, type SearchIndex, type SearchResults } from '../../core/search';

export interface SearchActions {
  symbol(nodeId: number): void;
  type(nodeIds: number[], text: string): void;
  signal(signalId: number): void;
}

const GROUP_TITLES = { symbols: 'Symbols', types: 'Symbol types', signals: 'Signals' };

export class SearchBox {
  private index: SearchIndex | null = null;
  private readonly input = document.querySelector<HTMLInputElement>('#search')!;
  private readonly results = document.querySelector<HTMLElement>('#results')!;

  constructor(private readonly actions: SearchActions) {
    this.input.oninput = () => this.update();
  }

  setIndex(index: SearchIndex | null): void {
    this.index = index;
    this.input.value = '';
    this.update();
  }

  private update(): void {
    this.results.replaceChildren();
    if (!this.index || !this.input.value.trim()) return;
    const r: SearchResults = search(this.index, this.input.value);
    this.group('symbols', r.symbols.map((x) => [x.text, () => this.actions.symbol(x.nodeId)]));
    this.group('types', r.types.map((x) => [`${x.text} (${x.nodeIds.length})`, () => this.actions.type(x.nodeIds, x.text)]));
    this.group('signals', r.signals.map((x) => [x.text, () => this.actions.signal(x.signalId)]));
  }

  private group(key: keyof typeof GROUP_TITLES, rows: [string, () => void][]): void {
    if (!rows.length) return;
    const section = document.createElement('section');
    section.dataset.group = key;
    const title = document.createElement('h3');
    title.textContent = GROUP_TITLES[key];
    section.append(title, ...rows.map(([text, act]) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = act;
      return b;
    }));
    this.results.append(section);
  }
}
