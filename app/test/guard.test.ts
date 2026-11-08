import { describe, expect, it, vi } from 'vitest';
import { guarded } from '../src/renderer/ui/guard';

describe('guarded', () => {
  it('reports what failed and why instead of rejecting', async () => {
    const report = vi.fn();
    await expect(guarded('Saving the image', async () => { throw new Error('EROFS'); }, report)()).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]![0]).toMatch(/Saving the image.*EROFS/);
  });
  it('reports a rejection that is not an Error', async () => {
    const report = vi.fn();
    await guarded('Copying', () => Promise.reject('denied'), report)();
    expect(report.mock.calls[0]![0]).toMatch(/Copying.*denied/);
  });
  it('reports nothing when the action succeeds', async () => {
    const report = vi.fn();
    const action = vi.fn(async () => {});
    await guarded('Copying', action, report)();
    expect(action).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });
});
