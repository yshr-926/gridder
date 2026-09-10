import { test, expect, readDocument } from '../helpers';

/**
 * Zoom and pan (issue #40, spec §4): cursor-centred wheel zoom and
 * middle-button / Space-drag pan. Neither belongs to Undo history.
 */
test.describe('zoom', () => {
  test('wheel zooms in/out, clamped, and stays correct for later grid gestures', async ({
    page,
    canvasHelper,
  }) => {
    const before = await canvasHelper.getViewport();
    expect(before.scale).toBe(1);

    await canvasHelper.wheelAtCenter(-200); // zoom in
    const zoomedIn = await canvasHelper.getViewport();
    expect(zoomedIn.scale).toBeGreaterThan(before.scale);

    await canvasHelper.wheelAtCenter(200); // zoom out past the original
    const zoomedOut = await canvasHelper.getViewport();
    expect(zoomedOut.scale).toBeLessThan(zoomedIn.scale);

    // A rectangle drawn while zoomed still lands at the exact requested
    // grid vertices — this is the point of routing every gesture through
    // CanvasHelper's live-viewport screen<->grid conversion (issue #58).
    await canvasHelper.dragGrid(2, 2, 7, 6);
    const document = await readDocument(page);
    expect(document.shapes[0].polygon.outerRing).toEqual([
      { x: 2, y: 2 },
      { x: 7, y: 2 },
      { x: 7, y: 6 },
      { x: 2, y: 6 },
    ]);
  });

  test('zoom is not part of undo history', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await canvasHelper.wheelAtCenter(-200);

    await page.keyboard.press('ControlOrMeta+z');
    // The shape creation is undone; the zoom level survives untouched.
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);
  });
});

test.describe('pan', () => {
  test('middle-button drag pans the viewport without creating a shape', async ({
    page,
    canvasHelper,
  }) => {
    const before = await canvasHelper.getViewport();
    await canvasHelper.middleDragPan(200, 200, 80, 40);

    const after = await canvasHelper.getViewport();
    expect(after.offset.x).not.toBe(before.offset.x);
    expect(after.offset.y).not.toBe(before.offset.y);
    expect((await readDocument(page)).shapeCount).toBe(0);
  });

  test('pan is not part of undo history', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await canvasHelper.middleDragPan(200, 200, 80, 40);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);
  });
});
