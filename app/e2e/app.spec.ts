import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const fixture = (n: string) => join(root, 'test/fixtures', n);
const EXAMPLE = join(root, '../example.smw');

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await electron.launch({ args: [join(root, 'out/main/index.js')] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});
test.afterEach(async () => app.close());

interface Item { name: string; bytes: number[] }
const item = (name: string, path?: string): Item => ({ name, bytes: path ? [...readFileSync(path)] : [65] });

function drop(items: Item[], folder = false): Promise<boolean> {
  return page.evaluate(([list, isFolder]) => {
    const files = (list as Item[]).map((x) => new File([new Uint8Array(x.bytes)], x.name));
    const e = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'dataTransfer', {
      value: { files, items: files.map(() => ({ webkitGetAsEntry: () => ({ isDirectory: isFolder }) })) },
    });
    return !document.body.dispatchEvent(e);
  }, [items, folder] as const);
}

const SEVERAL = 'Drop one file at a time.';

test('shows the invitation, then a map', async () => {
  await expect(page.locator('#empty')).toHaveText('Drop an SMW, UMC or CMC file here');
  await drop([item('median.smw', fixture('median.smw'))]);
  await expect(page.locator('#title')).toHaveText('Sample Program', { timeout: 30000 });
  await expect(page.locator('#map canvas')).toBeVisible();
  await expect(page.locator('#empty')).toBeHidden();
});

test('explains files that cannot be shown and keeps the map', async () => {
  await drop([item('p.umc', fixture('protected.umc'))]);
  await expect(page.locator('#message')).toHaveText("protected_sample: This file is protected and can't be displayed.");
  await drop([item('junk.smw')]);
  await expect(page.locator('#message')).toHaveText("This isn't a readable SIMPL program.");
  await drop([item('notes.txt')]);
  await expect(page.locator('#message')).toHaveText('Only .smw, .umc and .cmc files can be opened.');
  await drop([item('median.smw', fixture('median.smw'))]);
  await expect(page.locator('#title')).toHaveText('Sample Program', { timeout: 30000 });
  await drop([item('junk.smw')]);
  await expect(page.locator('#message')).toHaveText("This isn't a readable SIMPL program.");
  await expect(page.locator('#title')).toHaveText('Sample Program');
});

test('refuses several files or a folder without leaving the app', async () => {
  const url = page.url();
  expect(await drop([item('a.smw'), item('b.smw')])).toBe(true);
  await expect(page.locator('#message')).toHaveText(SEVERAL);
  await page.evaluate(() => (document.querySelector('#message')!.textContent = ''));
  expect(await drop([item('folder')], true)).toBe(true);
  await expect(page.locator('#message')).toHaveText(SEVERAL);
  expect(page.url()).toBe(url);
});

test('a later drop replaces a load in progress', async () => {
  await drop([item('p90.smw', fixture('p90.smw'))]);
  await drop([item('example.smw', EXAMPLE)]);
  const title = page.locator('#title');
  await expect(title).not.toHaveText('', { timeout: 30000 });
  const shown = await title.textContent();
  expect(shown).not.toBe('Sample Program');
  await page.waitForTimeout(6000);
  await expect(title).toHaveText(shown!);
});

test('search flies to a signal and lists where it appears', async () => {
  await drop([item('median.smw', fixture('median.smw'))]);
  await expect(page.locator('#title')).toHaveText('Sample Program', { timeout: 30000 });
  await page.locator('#search').fill('sig_');
  const first = page.locator('#results [data-group="signals"] button').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.locator('#occurrences')).toContainText(/appears in \d+ place/);
});

test('captures the view and the overview as PNG', async () => {
  await app.evaluate(({ ipcMain }) => {
    const g = globalThis as unknown as { saved: { name: string; head: number[] }[] };
    g.saved = [];
    ipcMain.removeHandler('save-png');
    ipcMain.handle('save-png', (_e, bytes: Uint8Array, name: string) => {
      g.saved.push({ name, head: [...bytes.slice(0, 8)] });
      return true;
    });
  });
  await drop([item('median.smw', fixture('median.smw'))]);
  await expect(page.locator('#title')).toHaveText('Sample Program', { timeout: 30000 });
  await page.locator('#save').click();
  await page.locator('#overview').click();
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { saved: unknown[] }).saved.length), { timeout: 30000 }).toBe(2);
  const saved = await app.evaluate(() => (globalThis as unknown as { saved: { name: string; head: number[] }[] }).saved);
  for (const s of saved) {
    expect(s.head).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(s.name).toMatch(/\.png$/);
  }
});

test('watching a file delivers each save to the page', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'smw-e2e-'));
  const file = join(dir, 'a.smw');
  writeFileSync(file, 'one');
  try {
    await page.evaluate((path) => {
      (window as unknown as { got: Promise<unknown> }).got = new Promise((ok) =>
        window.api.onFileChanged((p, bytes) => ok({ p, text: new TextDecoder().decode(bytes) })),
      );
      return window.api.watchFile(path);
    }, file);
    writeFileSync(file, 'two!');
    const got = await page.evaluate(() => (window as unknown as { got: Promise<unknown> }).got);
    expect(got).toEqual({ p: file, text: 'two!' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('auto-reload stays off for a file with no path on disk', async () => {
  await expect(page.locator('#autoreload')).toBeDisabled();
  await drop([item('example.smw', EXAMPLE)]);
  await expect(page.locator('#title')).not.toBeEmpty();
  await expect(page.locator('#autoreload')).toBeDisabled();
});
