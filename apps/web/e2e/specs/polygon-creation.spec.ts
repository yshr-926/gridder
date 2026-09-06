import { test, expect, readDocument, readSelection } from '../helpers';

/**
 * Polygon creation via the `P` shortcut / add-polygon button (issue #48,
 * spec §6.3): click to place vertices, click the start vertex (or press
 * Enter) to confirm, Esc to cancel.
 */

test.describe('polygon creation via P shortcut', () => {
  test('clicking three vertices then the start vertex confirms the polygon and selects it', async ({
    page,
    canvasHelper,
  }) => {
    await page.keyboard.press('p');

    await canvasHelper.clickGrid(10, 2);
    await canvasHelper.clickGrid(14, 2);
    await canvasHelper.clickGrid(12, 6);
    await canvasHelper.clickGrid(10, 2); // close on the start vertex

    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
    const document = await readDocument(page);
    expect(document.shapes[0].polygon.outerRing).toEqual([
      { x: 10, y: 2 },
      { x: 14, y: 2 },
      { x: 12, y: 6 },
    ]);
    await expect.poll(async () => (await readSelection(page)).selectedIds).toEqual([
      document.shapes[0].id,
    ]);
  });

  test('pressing Enter with 3+ vertices confirms the polygon', async ({ page, canvasHelper }) => {
    await page.keyboard.press('p');
    await canvasHelper.clickGrid(10, 2);
    await canvasHelper.clickGrid(14, 2);
    await canvasHelper.clickGrid(12, 6);
    await page.keyboard.press('Enter');

    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
  });

  test('pressing Escape cancels the in-progress polygon, creating nothing', async ({
    page,
    canvasHelper,
  }) => {
    await page.keyboard.press('p');
    await canvasHelper.clickGrid(10, 2);
    await canvasHelper.clickGrid(14, 2);
    await page.keyboard.press('Escape');

    expect((await readDocument(page)).shapeCount).toBe(0);
  });

  test('a self-intersecting polygon is refused; the shape count stays unchanged', async ({
    page,
    canvasHelper,
  }) => {
    await page.keyboard.press('p');
    // A bowtie: (0,0) -> (4,4) -> (4,0) -> (0,4) -> close, edges cross.
    await canvasHelper.clickGrid(2, 2);
    await canvasHelper.clickGrid(6, 6);
    await canvasHelper.clickGrid(6, 2);
    await canvasHelper.clickGrid(2, 6);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    expect((await readDocument(page)).shapeCount).toBe(0);
  });

  test('the polygon-creation gesture is undoable as one step', async ({ page, canvasHelper }) => {
    await page.keyboard.press('p');
    await canvasHelper.clickGrid(10, 2);
    await canvasHelper.clickGrid(14, 2);
    await canvasHelper.clickGrid(12, 6);
    await canvasHelper.clickGrid(10, 2);

    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);
  });
});

test.describe('polygon creation via the top-bar button', () => {
  test('the button toggles polygon creation on and Esc cancels it', async ({
    page,
    canvasHelper,
  }) => {
    const button = page.getByRole('button', { name: 'ポリゴンを追加' });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    await canvasHelper.clickGrid(10, 2);
    await page.keyboard.press('Escape');

    await expect(button).toHaveAttribute('aria-pressed', 'false');
    expect((await readDocument(page)).shapeCount).toBe(0);
  });
});
