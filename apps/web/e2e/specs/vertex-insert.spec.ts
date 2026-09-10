import { test, expect, readDocument, readSelection } from '../helpers';

/**
 * Ghost-vertex insertion (issue #64, issue #63 案 D) and commit-time
 * normalisation: a rectangle is bent into an L-shape by inserting vertices
 * from the ghosts on its edges, then bent back — and because duplicate and
 * collinear vertices are removed on commit, the shape is a 4-vertex
 * rectangle again and gets issue #44's resize handles back.
 *
 * Runs at the default zoom (20px cells, `scale === 1`) on an empty sketch,
 * so it also proves the ghost is reachable without zooming in.
 */

test.describe('vertex insertion from an edge ghost', () => {
  test('rectangle -> L-shape -> rectangle regains the resize handles', async ({
    page,
    canvasHelper,
  }) => {
    // A 6x6 rectangle at grid (2,2)-(8,8), selected.
    await canvasHelper.dragGrid(2, 2, 8, 8);
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
    await expect.poll(async () => (await readSelection(page)).selectedIds.length).toBe(1);

    // 1. Ghost on the top edge at (4,2) — an interior grid point away from
    //    the 'n' resize handle at (5,2) — dragged down to (4,4): a V-notch.
    await canvasHelper.dragGrid(4, 2, 4, 4);
    await expect
      .poll(async () => (await readDocument(page)).shapes[0].polygon.outerRing.length)
      .toBe(5);

    // 2. The former corner (2,2) is now a vertex of a non-rectangular
    //    polygon: drag it (issue #50) to (2,4).
    await canvasHelper.dragGrid(2, 2, 2, 4);

    // 3. Ghost on the diagonal (4,4)-(8,2) at its one interior grid point
    //    (6,3), dragged to (4,2): the L-shape is complete.
    await canvasHelper.dragGrid(6, 3, 4, 2);

    const lShape = await readDocument(page);
    expect(lShape.shapes[0].polygon.outerRing).toEqual([
      { x: 2, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 8 },
      { x: 2, y: 8 },
    ]);

    // 4. Drag the notch corner (4,4) back onto the rectangle's corner (2,2):
    //    the two vertices left on the edges are collinear and get removed on
    //    commit, so the shape is a plain 4-vertex rectangle again.
    await canvasHelper.dragGrid(4, 4, 2, 2);
    await expect
      .poll(async () => (await readDocument(page)).shapes[0].polygon.outerRing.length)
      .toBe(4);
    const restored = await readDocument(page);
    expect(restored.shapes[0].polygon.outerRing).toEqual([
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 8 },
      { x: 2, y: 8 },
    ]);

    // 5. Issue #44's handles are back: the bottom-right corner handle at
    //    (8,8) resizes the rectangle instead of moving a vertex freely.
    await canvasHelper.dragGrid(8, 8, 10, 10);
    const resized = await readDocument(page);
    expect(resized.shapes[0].polygon.outerRing).toEqual([
      { x: 2, y: 2 },
      { x: 10, y: 2 },
      { x: 10, y: 10 },
      { x: 2, y: 10 },
    ]);

    // Every step was one undo step: five undos return to the original rect.
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('ControlOrMeta+z');
    }
    const original = await readDocument(page);
    expect(original.shapes[0].polygon.outerRing).toEqual([
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 8 },
      { x: 2, y: 8 },
    ]);
  });

  test('clicking a ghost without dragging leaves no vertex behind', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 8, 8);
    await expect.poll(async () => (await readSelection(page)).selectedIds.length).toBe(1);

    await canvasHelper.clickGrid(4, 2);

    const document = await readDocument(page);
    expect(document.shapes[0].polygon.outerRing).toHaveLength(4);
    expect(document.canUndo).toBe(true); // only the creation
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);
  });
});
