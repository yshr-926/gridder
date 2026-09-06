import { test, expect, readDocument } from '../helpers';

/**
 * Copy / paste / duplicate / delete and z-order (issue #51, spec §7). Every
 * operation applies to single and multi-selections alike, as one undo step.
 */

test.describe('copy and paste', () => {
  test('Cmd/Ctrl+C then Cmd/Ctrl+V pastes a new shape, offset from the original', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    const original = (await readDocument(page)).shapes[0];

    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');

    const document = await readDocument(page);
    expect(document.shapeCount).toBe(2);
    const pasted = document.shapes.find((shape) => shape.id !== original.id)!;
    expect(pasted.polygon.outerRing).not.toEqual(original.polygon.outerRing);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
  });
});

test.describe('duplicate', () => {
  test('Cmd/Ctrl+D duplicates the selection as one undo step', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    const shapesBefore = (await readDocument(page)).shapeCount;

    await page.keyboard.press('ControlOrMeta+d');

    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(shapesBefore + 1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(shapesBefore);
  });

  test('duplicating a multi-selection duplicates every member as one undo step', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    await canvasHelper.clickGrid(3, 3);
    await canvasHelper.clickGrid(11, 3, { modifiers: ['Shift'] });

    await page.keyboard.press('ControlOrMeta+d');

    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(4);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(2);
  });
});

test.describe('delete', () => {
  test('Delete removes the selection as one undo step', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);

    await page.keyboard.press('Delete');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
  });
});

test.describe('z-order', () => {
  test('bring-to-front / send-to-back move a shape to the ends of the z-order', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    await canvasHelper.dragGrid(18, 2, 21, 5);
    const document = await readDocument(page);
    const [first] = document.shapes;
    expect(document.zOrder[0]).toBe(first.id);

    await canvasHelper.clickGrid(3, 3);
    await page.getByRole('button', { name: '最前面へ' }).click();

    await expect
      .poll(async () => {
        const zOrder = (await readDocument(page)).zOrder;
        return zOrder[zOrder.length - 1];
      })
      .toBe(first.id);

    await page.getByRole('button', { name: '最背面へ' }).click();
    await expect.poll(async () => (await readDocument(page)).zOrder[0]).toBe(first.id);
  });

  test('forward/backward step the shape by one position', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    const document = await readDocument(page);
    const [first, second] = document.shapes;
    expect(document.zOrder).toEqual([first.id, second.id]);

    await canvasHelper.clickGrid(3, 3);
    await page.getByRole('button', { name: '前面へ', exact: true }).click();

    await expect.poll(async () => (await readDocument(page)).zOrder).toEqual([
      second.id,
      first.id,
    ]);

    await page.getByRole('button', { name: '背面へ', exact: true }).click();
    await expect.poll(async () => (await readDocument(page)).zOrder).toEqual([
      first.id,
      second.id,
    ]);
  });
});
