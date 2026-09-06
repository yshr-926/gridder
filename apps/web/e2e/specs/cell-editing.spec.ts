import { test, expect, readDocument } from '../helpers';

/**
 * Cell editing (issue #49, spec §6.3): double-click a shape to enter a
 * temporary edit state, drag over cells to add them (Alt+drag removes),
 * Enter commits as one undo step, Esc discards.
 */

test.describe('adding cells', () => {
  test('double-click, drag over an adjacent cell, Enter grows the shape as one undo step', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(0, 0, 3, 3);
    const shapesBefore = (await readDocument(page)).shapeCount;

    await canvasHelper.doubleClickGrid(1, 1);
    // Cell (3,0)-(4,1) is adjacent to the rect's right edge.
    await canvasHelper.clickGrid(3.5, 0.5);
    await page.keyboard.press('Enter');

    const document = await readDocument(page);
    expect(document.shapeCount).toBe(shapesBefore);
    expect(document.shapes[0].polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ]);

    await page.keyboard.press('ControlOrMeta+z');
    await expect
      .poll(async () => (await readDocument(page)).shapes[0].polygon.outerRing)
      .toEqual([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
        { x: 0, y: 3 },
      ]);
  });
});

test.describe('removing cells (Alt+drag)', () => {
  test('Alt-drag over a cell carves a hole; Enter commits, undo restores the solid shape', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(0, 0, 3, 3);

    await canvasHelper.doubleClickGrid(1.5, 1.5);
    // Alt-drag the centre cell (1,1)-(2,2) out.
    await canvasHelper.dragGrid(1.5, 1.5, 1.5, 1.5, { altKey: true });
    await page.keyboard.press('Enter');

    const document = await readDocument(page);
    expect(document.zOrder).toHaveLength(1);
    expect(document.shapes[0].polygon.innerRings).toHaveLength(1);

    await page.keyboard.press('ControlOrMeta+z');
    await expect
      .poll(async () => (await readDocument(page)).shapes[0].polygon.innerRings)
      .toHaveLength(0);
  });

  test('Alt-drag disconnecting a shape splits it into two, undoable back to one', async ({
    page,
    canvasHelper,
  }) => {
    // A 5x2 rect; removing both cells of its middle column disconnects it
    // into a left and a right piece. Double-click lands away from every
    // edge/corner (issue #44's resize handles win a tie at exactly
    // `handleHitRadius`, so a click at a shape's exact centre on a 1-cell
    // axis is unsafe — this rect is 2 cells tall specifically to avoid that).
    await canvasHelper.dragGrid(0, 0, 5, 2);
    const shapesBefore = (await readDocument(page)).shapeCount;

    await canvasHelper.doubleClickGrid(1.5, 1);
    await canvasHelper.dragGrid(2.5, 0.5, 2.5, 1.5, { altKey: true });
    await page.keyboard.press('Enter');

    const document = await readDocument(page);
    expect(document.zOrder).toHaveLength(shapesBefore + 1);
    expect(document.shapes.map((shape) => shape.polygon.outerRing)).toEqual(
      expect.arrayContaining([
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
        [
          { x: 3, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 2 },
          { x: 3, y: 2 },
        ],
      ])
    );

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).zOrder).toHaveLength(shapesBefore);
  });
});

test.describe('cancelling an edit', () => {
  test('Escape discards the in-progress edit, leaving the document unchanged', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(0, 0, 3, 3);
    const before = (await readDocument(page)).shapes[0].polygon;

    await canvasHelper.doubleClickGrid(1, 1);
    await canvasHelper.clickGrid(3.5, 0.5);
    await page.keyboard.press('Escape');

    await expect
      .poll(async () => (await readDocument(page)).shapes[0].polygon)
      .toEqual(before);
  });
});
