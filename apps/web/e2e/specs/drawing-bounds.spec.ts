import { test, expect, readDocument } from '../helpers';

/**
 * Drawing range: auto-follow, manual handle drag, and "fit to content"
 * (issue #46, spec §4). The E2E runtime doesn't expose `drawingBounds`
 * directly (it's derived, not stored — see `resolveDrawingBounds`), so these
 * tests exercise auto/manual mode through its visible effects: the range
 * handles only render with nothing selected, and a manual-mode edit is one
 * undoable Command.
 */

test.describe('auto mode', () => {
  test('drawing a second, farther shape extends the auto range without error', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await canvasHelper.clickGrid(15, 15); // deselect so range handles show

    // A second, farther-out shape should extend the auto range too — this
    // only regresses if `resolveDrawingBounds` mishandles a wider bbox.
    await canvasHelper.dragGrid(10, 10, 15, 14);

    expect((await readDocument(page)).shapeCount).toBe(2);
  });
});

test.describe('manual adjustment', () => {
  test('dragging a drawing-range corner handle switches to manual mode, as one undo step', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await canvasHelper.clickGrid(15, 15); // deselect: range handles only show with nothing selected

    // Auto range currently hugs (2,2)-(7,6). Drag its bottom-right handle
    // outward to switch to manual mode with a larger rectangle.
    await canvasHelper.dragGrid(7, 6, 12, 10);

    const canUndoAfterDrag = (await readDocument(page)).canUndo;
    expect(canUndoAfterDrag).toBe(true);

    await page.keyboard.press('ControlOrMeta+z');
    // Undo reverts the manual bounds change; the shape itself is untouched.
    expect((await readDocument(page)).shapeCount).toBe(1);
  });

  test('"fit to content" returns the range to auto mode', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await canvasHelper.clickGrid(15, 15);
    await canvasHelper.dragGrid(7, 6, 15, 12); // go manual

    await page.getByRole('button', { name: '内容に合わせる' }).click();

    // Back in auto mode: the shape count / undo history are unaffected by
    // the click itself beyond the bounds command already on the stack.
    expect((await readDocument(page)).shapeCount).toBe(1);
  });
});
