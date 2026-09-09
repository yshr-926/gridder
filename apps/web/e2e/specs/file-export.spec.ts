import type { Page } from '@playwright/test';
import { test, expect } from '../helpers';

/**
 * Sketch save (JSON, fallback download path) and share-image export
 * (issue #54 / #56 / #67, spec §3 basic workflow step 5 / §9 / §10).
 *
 * Chromium in a Playwright-driven browser exposes `showSaveFilePicker` /
 * `showOpenFilePicker`, but a real picker dialog can't be automated, so the
 * save test removes them and reloads before saving — `selectFileAdapter`
 * then always falls back to `DownloadFallbackAdapter` (ADR-0004), the path
 * spec §9 describes for Firefox/Safari today and Chromium exercises
 * identically. `test.beforeEach` would run too late for `addInitScript` to
 * cover the `page` fixture's own first `goto` (see `helpers/setup.ts`), so
 * this reloads once itself instead.
 */
const forceDownloadFallback = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).showSaveFilePicker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).showOpenFilePicker;
  });
  await page.reload();
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { __GRIDDER_EDITOR_SESSION__?: unknown }).__GRIDDER_EDITOR_SESSION__
      ),
    undefined,
    { timeout: 30000 }
  );
};

test.describe('save as JSON (fallback download)', () => {
  test('saving downloads a .json file with the document content', async ({
    page,
    canvasHelper,
  }) => {
    await forceDownloadFallback(page);
    await canvasHelper.dragGrid(2, 2, 7, 6);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ファイル' }).click();
    await page.getByRole('menuitem', { name: '保存', exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    if (path) {
      const fs = await import('node:fs/promises');
      const content = JSON.parse(await fs.readFile(path, 'utf-8'));
      expect(content).toHaveProperty('formatVersion');
      expect(content).toHaveProperty('shapes');
    }
  });
});

test.describe('share image export', () => {
  test('exporting as PNG downloads a non-empty .png file', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);

    await page.getByRole('button', { name: '共有' }).click();
    await expect(page.getByText('共有画像')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '書き出す' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    if (path) {
      const fs = await import('node:fs/promises');
      const stats = await fs.stat(path);
      expect(stats.size).toBeGreaterThan(0);
    }
  });

  test('exporting as JPEG downloads a non-empty .jpeg file', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);

    await page.getByRole('button', { name: '共有' }).click();
    await page.getByRole('button', { name: 'JPEG' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '書き出す' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.(jpg|jpeg)$/);
    const path = await download.path();
    if (path) {
      const fs = await import('node:fs/promises');
      const stats = await fs.stat(path);
      expect(stats.size).toBeGreaterThan(0);
    }
  });

  test('the export button is disabled with no shapes on the sketch', async ({ page }) => {
    await page.getByRole('button', { name: '共有' }).click();
    await expect(page.getByRole('button', { name: '書き出す' })).toBeDisabled();
  });

  test('the panel previews the image and shows the output size for the chosen scale (issue #67)', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6); // 5 × 4 cells → 100 × 80 px at 1x

    await page.getByRole('button', { name: '共有' }).click();
    await expect(page.getByTestId('share-image-preview').locator('canvas')).toBeVisible();
    await expect(page.getByTestId('share-image-output-size')).toHaveText('200 × 160 px');

    await page.getByRole('button', { name: '3x' }).click();
    await expect(page.getByTestId('share-image-output-size')).toHaveText('300 × 240 px');

    await page.getByRole('button', { name: '中' }).click(); // +2 cells each side → 9 × 8 cells
    await expect(page.getByTestId('share-image-output-size')).toHaveText('540 × 480 px');
  });

  test('the exported PNG has exactly the displayed pixel size (issue #67)', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);

    await page.getByRole('button', { name: '共有' }).click();
    await page.getByRole('button', { name: '3x' }).click();
    await page.getByRole('button', { name: '小' }).click(); // 7 × 6 cells × 20 px × 3
    await expect(page.getByTestId('share-image-output-size')).toHaveText('420 × 360 px');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '書き出す' }).click();
    const download = await downloadPromise;

    const path = await download.path();
    expect(path).toBeTruthy();
    if (path) {
      const fs = await import('node:fs/promises');
      const bytes = await fs.readFile(path);
      // PNG IHDR: width at byte 16, height at byte 20, both big-endian.
      expect(bytes.readUInt32BE(16)).toBe(420);
      expect(bytes.readUInt32BE(20)).toBe(360);
    }
  });

  test('transparent background is only offered for PNG (issue #67)', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);

    await page.getByRole('button', { name: '共有' }).click();
    await page.getByRole('button', { name: '透明', exact: true }).click();
    await expect(page.getByRole('button', { name: '透明', exact: true })).toHaveAttribute('data-pressed', '');

    await page.getByRole('button', { name: 'JPEG' }).click();
    await expect(page.getByRole('button', { name: '透明', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '白', exact: true })).toHaveAttribute('data-pressed', '');

    await page.getByRole('button', { name: 'PNG' }).click();
    await expect(page.getByRole('button', { name: '透明', exact: true })).toHaveAttribute('data-pressed', '');
  });
});
