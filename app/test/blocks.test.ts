import { describe, expect, it } from 'vitest';
import { classify, decode, readBlocks } from '../src/core/blocks';

const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

describe('readBlocks', () => {
  it('keeps brackets and equals signs inside a value', () => {
    expect(readBlocks('[\r\nObjTp=Sg\r\nNm=a=b]c[d\r\n]\r\n').at(0)!.get('Nm')).toBe('a=b]c[d');
  });
  it('treats bare LF like CRLF', () => {
    expect(readBlocks('[\nObjTp=Sg\nNm=x\n]\n')).toEqual(readBlocks('[\r\nObjTp=Sg\r\nNm=x\r\n]\r\n'));
  });
  it('ignores text outside blocks and lines without =', () => {
    const b = readBlocks('junk\n[\nObjTp=Sg\nnoequals\n]\nmore=junk\n');
    expect(b).toHaveLength(1);
    expect([...b[0]!.keys()]).toEqual(['ObjTp']);
  });
  it('keeps the first of a repeated key', () => {
    expect(readBlocks('[\nA=1\nA=2\n]\n')[0]!.get('A')).toBe('1');
  });
  it('keeps an empty value', () => {
    expect(readBlocks('[\nA=\n]\n')[0]!.get('A')).toBe('');
  });
});

describe('classify', () => {
  it('reports a protected file with its name even though objects are present', () => {
    const r = classify(bytes('[\nObjTp=Hd\nPrNm=x.umc\n]\nFeSchVr=001\n\x01\x02'));
    expect(r).toEqual({ status: 'protected', name: 'x.umc' });
  });
  it('reports junk as unreadable', () => {
    expect(classify(Uint8Array.from([1, 200, 3, 91, 10]))).toEqual({ status: 'unreadable' });
  });
  it('reports empty input as unreadable', () => {
    expect(classify(new Uint8Array())).toEqual({ status: 'unreadable' });
  });
  it('returns blocks for a plain program', () => {
    const r = classify(bytes('[\nObjTp=Hd\n]\n'));
    expect(r.status).toBe('ok');
  });
});

it('decodes byte 0x92 as a curly apostrophe', () => {
  expect(decode(Uint8Array.from([0x92]))).toBe('’');
});
