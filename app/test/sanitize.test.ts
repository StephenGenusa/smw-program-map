import { describe, expect, it } from 'vitest';
import { readBlocks } from '../src/core/blocks';
import { computeConnections } from '../src/core/connections';
import { buildProgram } from '../src/core/program';
import type { RawBlock } from '../src/core/types';
import { sanitize } from '../tools/sanitize';

type O = Record<string, string | number>;
const b = (o: O): RawBlock => new Map(Object.entries(o).map(([k, v]) => [k, String(v)]));
const input = [
  b({ ObjTp: 'FSgntr', Sgntr: 'SimplWindow', SavedBy: 'SMW4' }),
  b({ ObjTp: 'Hd', CltNm: 'MARK_CLIENT', PrNm: 'MARK_FILE', DlrNm: 'MARK_DEALER', Cmn1: 'MARK_HC' }),
  b({ ObjTp: 'Dv', H: 2, Nm: 'MARK_DEVICE' }),
  b({ ObjTp: 'Sm', H: 1, SmC: 156, Cmn1: 'MARK_FOLDER', Cmn2: 'MARK_C2', C1: 10, C2: 11, C3: 12 }),
  b({ ObjTp: 'Sm', H: 10, PrH: 1, SmC: 155, Nm: 'MARK macro.umc', O1: 4, Secret: 'MARK_KEY' }),
  b({ ObjTp: 'Sm', H: 11, PrH: 1, SmC: 20, Nm: 'DM-MD8x8', I1: 4, I2: 1, OpF: 0 }),
  b({ ObjTp: 'Sm', H: 12, PrH: 1, SmC: 20, Nm: "john's lamp", DvH: 2 }),
  b({ ObjTp: 'Sg', H: 4, Nm: 'MARK_SIGNAL', SgTp: 2 }),
];
const out = sanitize(input);
const blocks = readBlocks(out);

describe('sanitize', () => {
  it('keeps only allowlisted object types', () => {
    expect([...new Set(blocks.map((x) => x.get('ObjTp')))].sort()).toEqual(['FSgntr', 'Hd', 'Sg', 'Sm']);
  });
  it('removes every marked value and unlisted key', () => {
    expect(out).not.toMatch(/MARK|Secret|john/);
  });
  it('replaces names by kind', () => {
    const p = buildProgram(blocks, 'x');
    expect(p.signals.get(4)!.name).toBe('sig_4');
    expect(p.nodes.get(1)!.name).toBe('folder_1');
    expect(p.nodes.get(10)!.name).toBe('module_10');
    expect(p.nodes.get(11)!.name).toBe('DM-MD8x8');
    expect(p.nodes.get(12)!.name).toBe('symbol_12');
  });
  it('preserves structure', () => {
    const a = buildProgram(input, 'x');
    const z = buildProgram(blocks, 'x');
    const totals = (p: typeof a) => {
      const c = computeConnections(p);
      return [p.nodes.size, [...p.nodes.values()].reduce((n, x) => n + x.pins.length, 0), c.lines.length, c.tagsByNode.size];
    };
    expect(totals(z)).toEqual(totals(a));
    expect(z.nodes.get(11)!.disabled).toBe(true);
    expect(z.signals.get(4)!.kind).toBe('analog');
  });
});
