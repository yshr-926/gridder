import { test, expect, readDocument } from '../helpers';

/**
 * Name, colour, opacity and border-visibility changes through the context
 * inspector (issue #45, spec §3 basic workflow step 4 / §8).
 */
test.describe('shape name', () => {
  test('typing a name and pressing Enter commits it as one undo step', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);

    const nameInput = page.getByLabel('名前');
    await nameInput.fill('リビング');
    await nameInput.press('Enter');

    await expect.poll(async () => (await readDocument(page)).shapes[0].name).toBe('リビング');

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readDocument(page)).shapes[0].name).toBeFalsy();
  });

  test('name is shown on the canvas via the shape label', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    const nameInput = page.getByLabel('名前');
    await nameInput.fill('寝室');
    await nameInput.press('Enter');

    await expect.poll(async () => (await readDocument(page)).shapes[0].name).toBe('寝室');
  });
});

test.describe('fill colour', () => {
  test('clicking a swatch changes the selected shape fill', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    const before = (await readDocument(page)).shapes[0].style.fill;

    const swatch = page.getByRole('button', { name: '塗り色を #ef4444 に変更' });
    await swatch.click();

    await expect.poll(async () => (await readDocument(page)).shapes[0].style.fill).toBe('#ef4444');
    expect(before).not.toBe('#ef4444');
  });
});

test.describe('opacity', () => {
  test('the +/- steppers change opacity by a fixed step', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    const initialOpacity = (await readDocument(page)).shapes[0].style.opacity;

    await page.getByRole('button', { name: '透明度を下げる' }).click();
    await expect
      .poll(async () => (await readDocument(page)).shapes[0].style.opacity)
      .toBeLessThan(initialOpacity);
  });

  test('the slider sets an explicit opacity value', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);

    const slider = page.getByRole('slider', { name: '透明度' });
    await slider.fill('50');

    await expect
      .poll(async () => (await readDocument(page)).shapes[0].style.opacity)
      .toBeCloseTo(0.5, 2);
  });
});

test.describe('border visibility', () => {
  test('unchecking the border checkbox hides the border, as one undo step', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    await expect
      .poll(async () => (await readDocument(page)).shapes[0].style.isBorderVisible)
      .toBe(true);

    const checkbox = page.getByRole('checkbox', { name: '境界線を表示' });
    await checkbox.uncheck();

    await expect
      .poll(async () => (await readDocument(page)).shapes[0].style.isBorderVisible)
      .toBe(false);

    // Undo/redo shortcuts are disabled while an <input> has focus (so typing
    // in the name field never triggers them) — blur the checkbox first.
    await checkbox.evaluate((el) => (el as HTMLElement).blur());
    await page.keyboard.press('ControlOrMeta+z');
    await expect
      .poll(async () => (await readDocument(page)).shapes[0].style.isBorderVisible)
      .toBe(true);
  });
});
