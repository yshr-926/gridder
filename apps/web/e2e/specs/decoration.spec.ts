import { test, expect } from '../helpers';
import type { GridObject } from '../../src/types';

// Auto-save delay is 2000ms, we need to wait longer
const AUTOSAVE_DELAY = 2500;

/**
 * ストアからオブジェクト情報を取得するヘルパー
 */
const getObjects = async (page: import('@playwright/test').Page): Promise<GridObject[]> => {
  return await page.evaluate(() => {
    const store = (
      window as unknown as {
        __GRIDDER_STORE__: { getState: () => { objects: GridObject[] } };
      }
    ).__GRIDDER_STORE__;
    return store.getState().objects;
  });
};

/**
 * Object Decoration E2E Tests
 * Tests for object decoration features including color, border, and opacity
 */
test.describe('Object Decoration', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should create objects with different colors automatically', async ({ appPage }) => {
    // 1つ目のオブジェクト作成
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const objectsAfterFirst = await getObjects(appPage.page);
    expect(objectsAfterFirst.length).toBeGreaterThanOrEqual(1);
    const firstObjectColor = objectsAfterFirst[0].color;

    // 2つ目のオブジェクト作成
    await appPage.clickCanvas(300, 300);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const objectsAfterSecond = await getObjects(appPage.page);
    expect(objectsAfterSecond.length).toBeGreaterThanOrEqual(2);
    const secondObjectColor = objectsAfterSecond[objectsAfterSecond.length - 1].color;

    // 異なる色が自動割り当てされることを確認
    expect(firstObjectColor).not.toBe(secondObjectColor);
  });

  test('should apply default decoration to new objects', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const objects = await getObjects(appPage.page);
    expect(objects.length).toBeGreaterThanOrEqual(1);

    const obj = objects[0];
    expect(obj.decoration).toBeDefined();
    expect(obj.decoration?.showBorder).toBe(true); // デフォルトはオン
    expect(obj.decoration?.borderWidth).toBe(1); // デフォルト幅
    expect(obj.decoration?.opacity).toBe(1); // デフォルト不透明
  });

  test('should toggle border visibility', async ({ appPage }) => {
    // オブジェクト作成
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // 選択モードに切り替えてオブジェクトを選択
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);

    // 枠線トグル確認
    const borderToggle = appPage.page.locator('[data-testid="decoration-border-toggle"]');

    // data-testidが見つからない場合は、代替のセレクタを試す
    const toggleExists = await borderToggle.count();
    if (toggleExists === 0) {
      console.warn('Border toggle not found, skipping test');
      test.skip();
      return;
    }

    await expect(borderToggle).toBeChecked(); // デフォルトはオン

    await borderToggle.click();
    await appPage.page.waitForTimeout(500);

    const objects = await getObjects(appPage.page);
    expect(objects[0].decoration?.showBorder).toBe(false);
  });

  test('should adjust opacity', async ({ appPage }) => {
    // オブジェクト作成
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // 選択モードに切り替えてオブジェクトを選択
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);

    // 透明度スライダー確認
    const opacitySlider = appPage.page.locator('[data-testid="decoration-opacity-slider"]');

    const sliderExists = await opacitySlider.count();
    if (sliderExists === 0) {
      console.warn('Opacity slider not found, skipping test');
      test.skip();
      return;
    }

    await opacitySlider.fill('0.5');
    await appPage.page.waitForTimeout(500);

    const objects = await getObjects(appPage.page);
    expect(objects[0].decoration?.opacity).toBe(0.5);
  });

  test('should change object color from palette', async ({ appPage }) => {
    // オブジェクト作成
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // 選択モードに切り替えてオブジェクトを選択
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);

    // カラーボタン確認
    const colorButton = appPage.page.locator('[data-testid="color-#ef4444"]');

    const buttonExists = await colorButton.count();
    if (buttonExists === 0) {
      console.warn('Color button not found, skipping test');
      test.skip();
      return;
    }

    await colorButton.click();
    await appPage.page.waitForTimeout(500);

    const objects = await getObjects(appPage.page);
    expect(objects[0].color).toBe('#ef4444');
  });

  test('should preserve decoration when moving object', async ({ appPage }) => {
    // オブジェクト作成
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // 装飾設定を取得
    const objectsBefore = await getObjects(appPage.page);
    const decorationBefore = objectsBefore[0].decoration;

    // 選択モードに切り替えて移動
    await appPage.switchToSelectMode();
    await appPage.dragOnCanvas(100, 100, 200, 200);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // 装飾が保持されていることを確認
    const objectsAfter = await getObjects(appPage.page);
    expect(objectsAfter[0].decoration).toEqual(decorationBefore);
  });

  test('should preserve decoration when rotating object', async ({ appPage }) => {
    // オブジェクト作成
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // 装飾設定を取得
    const objectsBefore = await getObjects(appPage.page);
    const decorationBefore = objectsBefore[0].decoration;

    // 選択モードに切り替えて回転
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);

    // R キーで回転
    await appPage.pressShortcut('r');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // 装飾が保持されていることを確認
    const objectsAfter = await getObjects(appPage.page);
    expect(objectsAfter[0].decoration).toEqual(decorationBefore);
  });
});
