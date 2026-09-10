import type { Page } from '@playwright/test';
import { test, expect, readDocument } from '../helpers';

/**
 * Sketch-wide annotation font size from the settings panel (issue #66, spec
 * §8 / §12): one value for every shape name and dimension label, stored in
 * the document, undoable, and reflected on the live canvas.
 *
 * The canvas is a Konva `<canvas>`, so "the name got bigger" is read from the
 * Konva node tree (`Konva.stages`, exposed by the Konva runtime itself) rather
 * than from pixels: the annotation `Text` node's `fontSize` is the value the
 * renderer actually drew with.
 */
const readAnnotationFontSizesOnCanvas = (page: Page): Promise<number[]> =>
  page.evaluate(() => {
    interface KonvaTextLike {
      fontSize: () => number;
      getParent: () => { name: () => string } | null;
    }
    const konva = (
      window as unknown as {
        Konva?: { stages: readonly { find: (selector: string) => readonly KonvaTextLike[] }[] };
      }
    ).Konva;
    // The first Stage is the live editor; the share panel's preview `ExportStage`
    // (#56 / #67) is a later one whenever that panel is open.
    const stage = konva?.stages[0];
    if (stage === undefined) {
      return [];
    }
    return stage
      .find('Text')
      .filter((node) => node.getParent()?.name().startsWith('shape-annotation-') ?? false)
      .map((node) => node.fontSize());
  });

const openSettings = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: '設定' }).click();
  await expect(page.getByLabel('文字サイズ')).toBeVisible();
};

test.describe('annotation font size', () => {
  test('the settings panel shows the default of 12 px', async ({ page }) => {
    await openSettings(page);

    await expect(page.getByLabel('文字サイズ')).toHaveValue('12');
    expect((await readDocument(page)).annotationFontSize).toBe(12);
  });

  test('changing the size updates the document, the canvas label, and is one undo step', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 10, 8);
    const nameInput = page.getByLabel('名前');
    await nameInput.fill('リビング');
    await nameInput.press('Enter');
    await expect.poll(() => readAnnotationFontSizesOnCanvas(page)).toEqual([12]);

    await openSettings(page);
    const input = page.getByLabel('文字サイズ');
    await input.fill('20');
    await input.press('Enter');

    await expect.poll(async () => (await readDocument(page)).annotationFontSize).toBe(20);
    await expect.poll(() => readAnnotationFontSizesOnCanvas(page)).toEqual([20]);

    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');

    await expect.poll(async () => (await readDocument(page)).annotationFontSize).toBe(12);
    await expect.poll(() => readAnnotationFontSizesOnCanvas(page)).toEqual([12]);
    // Only the font-size change was undone; the named shape is still there.
    expect((await readDocument(page)).shapes[0].name).toBe('リビング');
  });

  test('a value outside 8-32 px is clamped', async ({ page }) => {
    await openSettings(page);
    const input = page.getByLabel('文字サイズ');

    await input.fill('99');
    await input.press('Enter');
    await expect.poll(async () => (await readDocument(page)).annotationFontSize).toBe(32);
    await expect(input).toHaveValue('32');

    await input.fill('2');
    await input.press('Enter');
    await expect.poll(async () => (await readDocument(page)).annotationFontSize).toBe(8);
    await expect(input).toHaveValue('8');
  });
});
