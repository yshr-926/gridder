import { test, expect, readDocument, readSelection } from '../helpers';

/**
 * Grouping / ungrouping and double-click into a group's members (issue #52,
 * spec §7): `Cmd/Ctrl+G` groups, `Cmd/Ctrl+Shift+G` ungroups, groups move /
 * rotate / delete as one unit, and nesting is impossible by construction.
 */

test.describe('grouping and ungrouping', () => {
  test('Cmd/Ctrl+G groups a multi-selection; the group moves and deletes as one unit', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    const document = await readDocument(page);
    const [first, second] = document.shapes;

    await canvasHelper.clickGrid(3, 3);
    await canvasHelper.clickGrid(11, 3, { modifiers: ['Shift'] });
    await page.keyboard.press('ControlOrMeta+g');

    await expect.poll(async () => (await readDocument(page)).groupCount).toBe(1);

    // Moving the group moves both members together.
    await canvasHelper.dragGrid(3, 3, 4, 4);
    const afterMove = await readDocument(page);
    const movedFirst = afterMove.shapes.find((shape) => shape.id === first.id)!;
    const movedSecond = afterMove.shapes.find((shape) => shape.id === second.id)!;
    expect(movedFirst.polygon.outerRing[0]).toEqual({ x: 3, y: 3 });
    expect(movedSecond.polygon.outerRing[0]).toEqual({ x: 11, y: 3 });

    // Deleting the group deletes both members as one undo step.
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(2);
  });

  test('Shift-clicking a member out of a two-shape group leaves it unselected and undeleted', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    const document = await readDocument(page);
    const [first, second] = document.shapes;

    await canvasHelper.clickGrid(3, 3);
    await canvasHelper.clickGrid(11, 3, { modifiers: ['Shift'] });
    await page.keyboard.press('ControlOrMeta+g');
    await expect.poll(async () => (await readDocument(page)).groupCount).toBe(1);

    // Clicking one member selects the whole group; Shift-clicking the other
    // takes it back out. With only two members the selection is down to a
    // single shape, which must not read as "one member clicked".
    await canvasHelper.clickGrid(3, 3);
    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(2);
    await canvasHelper.clickGrid(11, 3, { modifiers: ['Shift'] });
    await expect.poll(async () => (await readSelection(page)).selectedIds).toEqual([first.id]);

    await page.keyboard.press('Delete');

    // Only the still-selected shape is gone.
    await expect.poll(async () => (await readDocument(page)).shapeCount).toBe(1);
    expect((await readDocument(page)).shapes[0].id).toBe(second.id);
  });

  test('Shift-clicking an unselected group adds every member at once', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    await canvasHelper.dragGrid(18, 2, 21, 5);

    // Group the first two, then Shift-click the group while the third is
    // selected: the whole group joins the selection.
    await canvasHelper.clickGrid(3, 3);
    await canvasHelper.clickGrid(11, 3, { modifiers: ['Shift'] });
    await page.keyboard.press('ControlOrMeta+g');

    await canvasHelper.clickGrid(19, 3);
    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(1);
    await canvasHelper.clickGrid(3, 3, { modifiers: ['Shift'] });

    await expect.poll(async () => (await readSelection(page)).selectedIds).toHaveLength(3);
  });

  test('Cmd/Ctrl+Shift+G ungroups; members become independently selectable', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    await canvasHelper.clickGrid(3, 3);
    await canvasHelper.clickGrid(11, 3, { modifiers: ['Shift'] });
    await page.keyboard.press('ControlOrMeta+g');
    await expect.poll(async () => (await readDocument(page)).groupCount).toBe(1);

    await page.keyboard.press('ControlOrMeta+Shift+g');
    await expect.poll(async () => (await readDocument(page)).groupCount).toBe(0);

    // Clicking one member now selects only that shape.
    const document = await readDocument(page);
    await canvasHelper.clickGrid(3, 3);
    await expect
      .poll(async () => (await readSelection(page)).selectedIds)
      .toEqual([document.shapes[0].id]);
  });

  test('grouping a selection that overlaps an existing group dissolves and replaces it (nesting is impossible)', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    await canvasHelper.dragGrid(18, 2, 21, 5);

    await canvasHelper.clickGrid(3, 3);
    await canvasHelper.clickGrid(11, 3, { modifiers: ['Shift'] });
    await page.keyboard.press('ControlOrMeta+g');
    await expect.poll(async () => (await readDocument(page)).groupCount).toBe(1);

    // Re-group b with c: the first group (a+b) dissolves, replaced by (b+c).
    await canvasHelper.clickGrid(11, 3);
    await canvasHelper.clickGrid(19, 3, { modifiers: ['Shift'] });
    await page.keyboard.press('ControlOrMeta+g');

    const after = await readDocument(page);
    expect(after.groupCount).toBe(1);
  });
});

test.describe('double-click into a group', () => {
  test('double-clicking a group member enters it and selects just that member', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.dragGrid(10, 2, 13, 5);
    const document = await readDocument(page);
    const [first] = document.shapes;

    await canvasHelper.clickGrid(3, 3);
    await canvasHelper.clickGrid(11, 3, { modifiers: ['Shift'] });
    await page.keyboard.press('ControlOrMeta+g');

    // A plain click on a member now selects the whole group.
    await canvasHelper.clickGrid(3, 3);
    await expect
      .poll(async () => [...(await readSelection(page)).selectedIds].sort())
      .toHaveLength(2);

    // Double-click enters the group: only the clicked member is selected.
    await canvasHelper.doubleClickGrid(3, 3);
    await expect.poll(async () => (await readSelection(page)).selectedIds).toEqual([first.id]);
    await expect.poll(async () => (await readSelection(page)).activeGroupId).not.toBeNull();
  });
});
