/** Wraps a button action so a failure is reported to the user instead of rejecting unseen. */
export function guarded(what: string, action: () => Promise<unknown>, report: (text: string) => void): () => Promise<void> {
  return async () => {
    try {
      await action();
    } catch (e) {
      report(`${what} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
}
