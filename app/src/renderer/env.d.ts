/// <reference types="vite/client" />
interface Window {
  api: { savePng(bytes: Uint8Array, suggestedName: string): Promise<boolean> };
}
