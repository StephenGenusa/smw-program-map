// Developer tool: times the load pipeline over a folder. Prints numbers only, never names or paths.
import { closeSync, openSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { runPipeline } from '../src/worker/pipeline';

const [dir, shard = '0', shards = '1'] = process.argv.slice(2);
const files = readdirSync(dir!, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && ['.smw', '.umc', '.cmc'].includes(extname(e.name).toLowerCase()))
  .map((e) => join(e.parentPath, e.name))
  .sort()
  .filter((_, i) => i % Number(shards) === Number(shard));

for (const path of files) {
  const ext = extname(path).toLowerCase();
  const started = performance.now();
  try {
    const fd = openSync(path, 'r');
    const bytes = readFileSync(fd);
    closeSync(fd);
    const r = await runPipeline(new Uint8Array(bytes), 'bench', () => {});
    const symbols = r.status === 'ok' ? r.program.nodes.size : 0;
    console.log([ext, r.status, symbols, Math.round(performance.now() - started)].join('\t'));
  } catch (e) {
    console.log([ext, `error:${e instanceof Error ? e.name : 'unknown'}`, 0, Math.round(performance.now() - started)].join('\t'));
  }
}
