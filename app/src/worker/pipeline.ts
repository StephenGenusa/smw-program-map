import { classify } from '../core/blocks';
import { computeConnections, type Connections } from '../core/connections';
import { layoutProgram, type Layout } from '../core/layout';
import { buildProgram } from '../core/program';
import type { Program } from '../core/types';

export type Stage = 'parse' | 'connect' | 'layout';
export type ProgressFn = (stage: Stage, done: number, total: number) => void;
export type LoadResult =
  | { status: 'ok'; program: Program; connections: Connections; layout: Layout }
  | { status: 'protected'; name: string | null }
  | { status: 'unreadable' };

export async function runPipeline(bytes: Uint8Array, fileName: string, onProgress: ProgressFn): Promise<LoadResult> {
  onProgress('parse', 0, 1);
  const file = classify(bytes);
  if (file.status !== 'ok') return file;
  const program = buildProgram(file.blocks, fileName);
  onProgress('connect', 0, 1);
  const connections = computeConnections(program);
  onProgress('layout', 0, 1);
  const layout = await layoutProgram(program, connections, (d, t) => onProgress('layout', d, t));
  return { status: 'ok', program, connections, layout };
}
