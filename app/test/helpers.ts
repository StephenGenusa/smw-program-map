import { buildProgram } from '../src/core/program';
import type { Program, RawBlock } from '../src/core/types';

type O = Record<string, string | number>;
const b = (o: O): RawBlock => new Map(Object.entries(o).map(([k, v]) => [k, String(v)]));
export const sm = (o: O) => b({ ObjTp: 'Sm', SmC: 20, ...o });
export const folder = (H: number, name: string, PrH?: number) =>
  b({ ObjTp: 'Sm', SmC: 156, H, Cmn1: name, ...(PrH ? { PrH } : {}) });
export const sg = (H: number, Nm = `s${H}`) => b({ ObjTp: 'Sg', H, Nm });
export const prog = (...x: RawBlock[]): Program => buildProgram(x, 'f.smw');
