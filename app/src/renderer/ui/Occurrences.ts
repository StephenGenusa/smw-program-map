const el = () => document.querySelector<HTMLElement>('#occurrences')!;

export interface Place {
  text: string;
  nodeId: number;
}

export function showOccurrences(heading: string, places: Place[], jump: (nodeId: number) => void): void {
  const title = document.createElement('h3');
  title.textContent = `${heading} appears in ${places.length} place${places.length === 1 ? '' : 's'}`;
  el().replaceChildren(title, ...places.map((p) => {
    const b = document.createElement('button');
    b.textContent = p.text;
    b.onclick = () => jump(p.nodeId);
    return b;
  }));
  el().hidden = false;
}

export function clearOccurrences(): void {
  el().replaceChildren();
  el().hidden = true;
}
