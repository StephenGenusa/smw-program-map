const el = () => document.querySelector<HTMLElement>('#message')!;

export function showMessage(text: string): void {
  el().textContent = text;
  el().hidden = false;
}

export function clearMessage(): void {
  el().textContent = '';
  el().hidden = true;
}
