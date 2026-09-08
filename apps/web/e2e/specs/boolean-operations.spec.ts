import { test, expect, readDocument, readSelection } from '../helpers';

/**
 * Combining and subtracting shapes (issue #62, spec §7, ADR-0006): the
 * inspector's "結合" / "くり抜き" buttons appear for a multi-selection only,
 * each dispatches one Command, and Undo restores the original shapes.
 */

test.describe('combine', () => {
  test('two rectangles sharing an edge combine into one L-shape, undoable back to two', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(0, 0, 3, 3);
    // Start the second drag on blank space: (3, 0) is the first rect's
    // corner, where its resize handle would win the pointer-down.
    await canvasHelper.dragGrid(5, 1, 3, 0);
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(2);

    await canvasHelper.clickGrid(1.5, 1.5);
    await canvasHelper.clickGrid(4, 0.5, { modifiers: ['Shift'] });
    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(2);

    await page.getByRole('button', { name: '結合' }).click();

    const document = await readDocument(page);
    expect(document.shapeCount).toBe(1);
    expect(document.shapes[0].polygon.outerRing).toHaveLength(6);
    expect(document.shapes[0].polygon.innerRings).toHaveLength(0);
    await expect.poll(async () => (await readSelection(page)).selectedIds).toEqual([
      document.shapes[0].id,
    ]);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(2);
    const restored = await readDocument(page);
    expect(restored.shapes[0].polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ]);
  });

  test('separated rectangles are refused with a toast and the document is unchanged', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(0, 0, 3, 3);
    await canvasHelper.dragGrid(6, 0, 9, 3);
    await canvasHelper.clickGrid(1.5, 1.5);
    await canvasHelper.clickGrid(7.5, 1.5, { modifiers: ['Shift'] });
    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(2);

    await page.getByRole('button', { name: '結合' }).click();

    await expect(page.getByText('離れた図形は結合できません', { exact: false })).toBeVisible();
    const document = await readDocument(page);
    expect(document.shapeCount).toBe(2);
    expect(document.shapes.map((shape) => shape.polygon.outerRing[0])).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ]);
    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(2);
  });

  test('the buttons are absent for a single selection', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(0, 0, 3, 3);
    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(1);

    await expect(page.getByRole('button', { name: '結合' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'くり抜き' })).toHaveCount(0);
  });
});

test.describe('subtract', () => {
  test('a small rectangle moved inside a large one carves a hole; undo restores both', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(0, 0, 5, 5);
    // The cutter is drawn on blank space (a drag over a shape would move it)
    // and then dragged into the middle of the subject. Drawn last, it is the
    // frontmost shape, so it becomes the cutter. It is 2x2 so its centre is
    // a full cell away from every resize handle (issue #44's handles win a
    // tie at exactly the hit radius, half a cell at zoom 1).
    await canvasHelper.dragGrid(8, 2, 10, 4);
    await canvasHelper.dragGrid(9, 3, 3, 3);
    await expect.poll(async () => (await readDocument(page)).shapes[1].polygon.outerRing[0]).toEqual({
      x: 2,
      y: 2,
    });

    await canvasHelper.clickGrid(1, 1);
    await canvasHelper.clickGrid(3, 3, { modifiers: ['Shift'] });
    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(2);

    await page.getByRole('button', { name: 'くり抜き' }).click();

    const document = await readDocument(page);
    expect(document.shapeCount).toBe(1);
    expect(document.shapes[0].polygon.innerRings).toHaveLength(1);
    await expect.poll(async () => (await readSelection(page)).selectedIds).toEqual([
      document.shapes[0].id,
    ]);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(2);
    expect((await readDocument(page)).shapes[0].polygon.innerRings).toHaveLength(0);
  });

  test('a cutter spanning the subject splits it into two shapes; undo restores one', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(0, 0, 5, 2);
    // A one-cell-wide, four-cell-tall cutter: grabbed at (8.5, 3), which is
    // a full cell from its side-edge handles at y = 2, then moved so it
    // spans the subject's full height at x = 2..3.
    await canvasHelper.dragGrid(8, 0, 9, 4);
    await canvasHelper.dragGrid(8.5, 3, 2.5, 3);
    await expect.poll(async () => (await readDocument(page)).shapes[1].polygon.outerRing[0]).toEqual({
      x: 2,
      y: 0,
    });

    await canvasHelper.clickGrid(1, 1);
    await canvasHelper.clickGrid(2.5, 3, { modifiers: ['Shift'] });
    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(2);

    await page.getByRole('button', { name: 'くり抜き' }).click();

    const document = await readDocument(page);
    expect(document.shapeCount).toBe(2);
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
    await expect
      .poll(async () => [...(await readSelection(page)).selectedIds].sort())
      .toEqual([...document.zOrder].sort());

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(2);
    const restored = await readDocument(page);
    expect(restored.shapes[0].polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(restored.shapes[1].polygon.outerRing[0]).toEqual({ x: 2, y: 0 });
  });
});
