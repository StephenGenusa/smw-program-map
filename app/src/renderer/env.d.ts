/// <reference types="vite/client" />
interface Window {
  api: {
    savePng(bytes: Uint8Array, suggestedName: string): Promise<boolean>;
    pathFor(file: File): string;
    watchFile(path: string | null): Promise<void>;
    onFileChanged(listener: (path: string, bytes: Uint8Array) => void): void;
  };
}
