import type { LoadResult, ProgressFn } from '../worker/pipeline';
import LoadWorker from '../worker/load.worker?worker';

let active: { worker: Worker; finish: (r: 'superseded') => void } | null = null;

export async function loadFile(file: File, onProgress: ProgressFn): Promise<LoadResult | 'superseded'> {
  if (active) {
    active.worker.terminate();
    active.finish('superseded');
    active = null;
  }
  const worker = new LoadWorker();
  return new Promise((resolve) => {
    const slot = { worker, finish: resolve };
    active = slot;
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        onProgress(e.data.stage, e.data.done, e.data.total);
      } else {
        worker.terminate();
        if (active === slot) active = null;
        resolve(e.data.result as LoadResult);
      }
    };
    worker.onerror = () => {
      worker.terminate();
      if (active === slot) active = null;
      resolve({ status: 'unreadable' });
    };
    file.arrayBuffer().then(
      (buf) => {
        if (active === slot) worker.postMessage({ bytes: new Uint8Array(buf), fileName: file.name }, [buf]);
      },
      () => {
        worker.terminate();
        if (active === slot) active = null;
        resolve({ status: 'unreadable' });
      },
    );
  });
}
