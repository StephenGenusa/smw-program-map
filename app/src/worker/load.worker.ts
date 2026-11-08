import { runPipeline } from './pipeline';

self.onmessage = async (e: MessageEvent<{ bytes: Uint8Array; fileName: string }>) => {
  try {
    const result = await runPipeline(e.data.bytes, e.data.fileName, (stage, done, total) =>
      self.postMessage({ type: 'progress', stage, done, total }),
    );
    self.postMessage({ type: 'done', result });
  } catch {
    self.postMessage({ type: 'done', result: { status: 'unreadable' } });
  }
};
