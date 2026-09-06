import { test, expect, readDocument } from '../helpers';

/**
 * Undo/Redo across the document's Command history (spec §11): every document
 * mutation is one Command, drag gestures coalesce into a single step, and the
 * top-bar buttons reflect `canUndo`/`canRedo`.
 */

test.describe('undo/redo history', () => {
  test('top-bar Undo/Redo buttons are disabled/enabled to match history state', async ({
    page,
    canvasHelper,
  }) => {
    const undoButton = page.getByRole('button', { name: '元に戻す' });
    const redoButton = page.getByRole('button', { name: 'やり直す' });
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    await canvasHelper.dragGrid(2, 2, 7, 6);
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    await undoButton.click();
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeEnabled();

    await redoButton.click();
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();
  });

  test('multiple operations undo in reverse order, one Command at a time', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5); // Command 1: create shape 1
    await canvasHelper.dragGrid(10, 2, 13, 5); // Command 2: create shape 2 (also selects it)
    await canvasHelper.dragGrid(11, 3, 12, 4); // Command 3: move shape 2 (still selected)

    expect((await readDocument(page)).shapeCount).toBe(2);

    await page.keyboard.press('ControlOrMeta+z'); // undo the move
    await page.keyboard.press('ControlOrMeta+z'); // undo 2nd shape creation
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);

    await page.keyboard.press('ControlOrMeta+z'); // undo 1st shape creation
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);
    await expect.poll(async () => (await readDocument(page)).canUndo).toBe(false);

    await page.keyboard.press('ControlOrMeta+Shift+z');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(2);
    await expect.poll(async () => (await readDocument(page)).canRedo).toBe(false);
  });

  test('a new edit after undo discards the redo branch', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    await page.keyboard.press('ControlOrMeta+z'); // undo shape 2
    expect((await readDocument(page)).canRedo).toBe(true);

    await canvasHelper.dragGrid(15, 10, 18, 13); // a new shape, branching history
    await expect.poll(async () => (await readDocument(page)).canRedo).toBe(false);
    expect((await readDocument(page)).shapeCount).toBe(2);
  });
});
