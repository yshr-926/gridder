import { test, expect, CanvasHelper, GRID_SIZE, readDocument, readSelection } from '../helpers';

/**
 * Direct manipulation on the polygon document (issues #42, #43, #44, #58,
 * spec §3 basic workflow / §6.1-6.2 / §15 prototype acceptance).
 *
 * Rectangle creation -> selection -> move -> edge/corner resize is the first
 * leg of spec §3's workflow; every gesture goes through {@link CanvasHelper}
 * so it stays correct at any zoom (issue #58).
 */

test.describe('rectangle creation, selection and move', () => {
  test('drag on blank canvas creates a shape, selects it, and the creation can be undone', async ({
    page,
    canvasHelper,
  }) => {
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);

    // Blank left-drag: grid vertex (2,2) -> (7,6).
    await canvasHelper.dragGrid(2, 2, 7, 6);

    // One shape now exists and is selected.
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
    await expect.poll(async () => (await readSelection(page)).selectedIds.length).toBe(1);
    await expect.poll(async () => (await readDocument(page)).canUndo).toBe(true);

    // Undo removes it.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);

    // Redo brings it back.
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
  });

  test('clicking blank space clears the selection', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await expect.poll(async () => (await readSelection(page)).selectedIds.length).toBe(1);

    // Click on empty canvas, away from the shape but still inside the
    // narrower canvas the context inspector leaves once something is
    // selected (ui-principles §1).
    await canvasHelper.clickGrid(15, 15);
    await expect.poll(async () => (await readSelection(page)).selectedIds.length).toBe(0);
  });

  test('clicking a shape selects it alone', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await canvasHelper.dragGrid(15, 2, 20, 6);
    const document = await readDocument(page);
    expect(document.shapeCount).toBe(2);
    const [first, second] = document.shapes;

    await canvasHelper.clickGrid(4, 4); // inside the first rect
    await expect.poll(async () => (await readSelection(page)).selectedIds).toEqual([first.id]);

    await canvasHelper.clickGrid(17, 4); // inside the second rect
    await expect.poll(async () => (await readSelection(page)).selectedIds).toEqual([second.id]);
  });

  test('shift-click adds and removes shapes from the selection', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await canvasHelper.dragGrid(15, 2, 20, 6);
    const document = await readDocument(page);
    const [first, second] = document.shapes;

    await canvasHelper.clickGrid(4, 4);
    await canvasHelper.clickGrid(17, 4, { modifiers: ['Shift'] });
    await expect
      .poll(async () => [...(await readSelection(page)).selectedIds].sort())
      .toEqual([first.id, second.id].sort());

    // Shift-clicking an already-selected shape removes it.
    await canvasHelper.clickGrid(17, 4, { modifiers: ['Shift'] });
    await expect.poll(async () => (await readSelection(page)).selectedIds).toEqual([first.id]);
  });

  test('shift-drag over blank space marquee-selects contained shapes', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    const document = await readDocument(page);
    const [first, second] = document.shapes;

    // Marquee fully containing both rects.
    await canvasHelper.dragGrid(0, 0, 15, 8, { shiftKey: true });
    await expect
      .poll(async () => [...(await readSelection(page)).selectedIds].sort())
      .toEqual([first.id, second.id].sort());
  });

  test('dragging inside a selected shape moves it, snapped to the grid, as one undo step', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 6, 5);
    await canvasHelper.clickGrid(3, 3);

    // Drag from inside the shape by (5, 3) grid cells.
    await canvasHelper.dragGrid(3, 3, 8, 6);

    const document = await readDocument(page);
    expect(document.shapes[0].polygon.outerRing[0]).toEqual({ x: 7, y: 5 });

    await page.keyboard.press('ControlOrMeta+z');
    const reverted = await readDocument(page);
    expect(reverted.shapes[0].polygon.outerRing[0]).toEqual({ x: 2, y: 2 });
  });
});

test.describe('rectangle resize via edge/corner handles', () => {
  test('dragging the bottom-right corner handle resizes the rectangle as one undo step', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 6, 5);
    await canvasHelper.clickGrid(3, 3);

    // The bottom-right corner handle sits at grid vertex (6, 5).
    await canvasHelper.dragGrid(6, 5, 9, 8);

    const document = await readDocument(page);
    const ring = document.shapes[0].polygon.outerRing;
    // A resized axis-aligned rect keeps 4 vertices; the far corner moved.
    expect(ring).toHaveLength(4);
    expect(ring.some((v) => v.x === 9 && v.y === 8)).toBe(true);

    await page.keyboard.press('ControlOrMeta+z');
    const reverted = await readDocument(page);
    const revertedRing = reverted.shapes[0].polygon.outerRing;
    expect(revertedRing.some((v) => v.x === 6 && v.y === 5)).toBe(true);
  });

  test('dragging the right edge handle resizes only that side', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 6, 5);
    await canvasHelper.clickGrid(3, 3);

    // Right edge midpoint at grid x=6, y=3.5 (between 2 and 5).
    await canvasHelper.dragGrid(6, 3, 9, 3);

    const document = await readDocument(page);
    const ring = document.shapes[0].polygon.outerRing;
    // Top-left corner is untouched; the right edge moved to x=9.
    expect(ring.some((v) => v.x === 2 && v.y === 2)).toBe(true);
    expect(ring.some((v) => v.x === 9)).toBe(true);
  });
});

test.describe('grid size constant', () => {
  test('GRID_SIZE matches the app default', async () => {
    expect(GRID_SIZE).toBe(20);
  });
});
