# Gridder E2E Test Helpers

このディレクトリには、E2Eテストを簡潔に書くためのヘルパー関数、カスタムフィクスチャ、アサーションが含まれています。

## ディレクトリ構成

```
e2e/helpers/
├── index.ts          # すべてのヘルパーを再エクスポート
├── canvas.ts         # CanvasHelper クラスと Canvas 操作関数
├── setup.ts          # カスタムテストフィクスチャ
├── assertions.ts     # カスタムアサーション
└── README.md         # このドキュメント
```

## 使い方

### 基本的なインポート

```typescript
import { test, expect, customExpect } from '../helpers';
```

### カスタムフィクスチャの使用

```typescript
test('example test', async ({ app, canvasHelper }) => {
  // app: AppPage インスタンス（Page Object Model）
  // canvasHelper: CanvasHelper インスタンス（グリッド操作）

  await app.switchToDrawMode();
  await canvasHelper.clickGrid(5, 5);
});
```

## カスタムフィクスチャ

### `app` フィクスチャ

Page Object Model を提供する `AppPage` インスタンス。ローカルストレージのクリアとページのリロードが自動で行われます。

```typescript
test('using app fixture', async ({ app }) => {
  await app.switchToDrawMode();
  await app.clickCanvas(100, 100);
  await app.switchToSelectMode();
});
```

### `canvasHelper` フィクスチャ

Canvas のグリッド座標操作を提供する `CanvasHelper` インスタンス。

```typescript
test('using canvasHelper', async ({ canvasHelper }) => {
  // グリッド座標でクリック
  await canvasHelper.clickGrid(5, 5);

  // グリッド座標でドラッグ
  await canvasHelper.dragGrid(2, 2, 8, 8);

  // 座標変換
  const pixel = await canvasHelper.gridToPixel(3, 3);
  const grid = await canvasHelper.pixelToGrid(pixel.x, pixel.y);
});
```

## CanvasHelper クラス

### メソッド一覧

| メソッド | 説明 |
|---------|------|
| `getGridSize()` | グリッドサイズを取得 |
| `gridToPixel(gridX, gridY)` | グリッド座標をピクセル座標に変換 |
| `pixelToGrid(pixelX, pixelY)` | ピクセル座標をグリッド座標に変換 |
| `clickGrid(gridX, gridY)` | 指定グリッド座標をクリック |
| `doubleClickGrid(gridX, gridY)` | 指定グリッド座標をダブルクリック |
| `dragGrid(startX, startY, endX, endY)` | グリッド座標間でドラッグ |
| `hoverGrid(gridX, gridY)` | 指定グリッド座標にホバー |
| `screenshot()` | Canvas のスクリーンショットを取得 |
| `getBoundingBox()` | Canvas の境界ボックスを取得 |
| `waitForRender(timeout)` | レンダリング完了を待機 |
| `waitForCanvas()` | Canvas 要素の準備を待機 |
| `getLocator()` | Canvas の Locator を取得 |
| `wheel(deltaX, deltaY)` | マウスホイール操作 |
| `ctrlWheel(deltaY)` | Ctrl + ホイール（ズーム）操作 |

### 使用例

```typescript
import { test } from '../helpers';

test('canvas helper example', async ({ app, canvasHelper }) => {
  await app.switchToDrawMode();

  // グリッド座標 (5, 5) をクリックして描画
  await canvasHelper.clickGrid(5, 5);

  // (2, 2) から (8, 8) までドラッグ描画
  await canvasHelper.dragGrid(2, 2, 8, 8);

  // レンダリング完了を待機
  await canvasHelper.waitForRender(500);

  // Canvas のスクリーンショットを取得
  const screenshot = await canvasHelper.screenshot();
});
```

## カスタムアサーション

### customExpect オブジェクト

Gridder 固有のアサーションを提供するオブジェクト。

```typescript
import { customExpect } from '../helpers';

test('custom assertions', async ({ app }) => {
  // オブジェクト数の確認
  await customExpect.toHaveObjectCount(app.page, 1);

  // ツールモードの確認
  await customExpect.toBeInToolMode(app.page, 'draw');

  // 選択状態の確認
  await customExpect.toHaveSelectedObject(app.page);
  await customExpect.toHaveNoSelectedObject(app.page);

  // エラーがないことを確認
  await customExpect.toHaveNoErrors(app.page);

  // ズームレベルの確認
  await customExpect.toHaveZoomLevel(app.page, 100);

  // ステータスバーのテキスト確認
  await customExpect.toHaveStatusText(app.page, '100%');

  // Canvas の可視性確認
  await customExpect.toHaveVisibleCanvas(app.page);

  // プロジェクト保存の確認
  await customExpect.toHaveSavedProject(app.page);
});
```

### 独立したアサーション関数

| 関数 | 説明 |
|------|------|
| `expectCanvasHasContent(page)` | Canvas にコンテンツがあることを確認 |
| `expectCanvasIsEmpty(page)` | Canvas が空であることを確認 |
| `expectLocalStorageHasProject(page)` | LocalStorage にプロジェクトがあることを確認 |
| `expectDownload(page, action, filename)` | ダウンロードがトリガーされることを確認 |
| `expectElementFocused(page, selector)` | 要素がフォーカスされていることを確認 |
| `expectTabNavigation(page, selectors)` | Tab ナビゲーションの順序を確認 |
| `expectObjectCount(page, count)` | オブジェクト数を確認 |
| `expectToolbarVisible(page)` | ツールバーが表示されていることを確認 |
| `expectPropertyPanelVisible(page)` | プロパティパネルが表示されていることを確認 |
| `expectStatusBarVisible(page)` | ステータスバーが表示されていることを確認 |
| `expectNoConsoleErrors(page, action)` | コンソールエラーがないことを確認 |
| `expectModalVisible(page, titlePattern)` | モーダルが表示されていることを確認 |
| `expectNoModal(page)` | モーダルがないことを確認 |

### 使用例

```typescript
import { expectDownload, expectToolbarVisible } from '../helpers';

test('download assertion', async ({ app }) => {
  await expectToolbarVisible(app.page);

  const filename = await expectDownload(
    app.page,
    async () => {
      await app.exportJSONButton.click();
    },
    /gridder.*\.json/
  );
});
```

## ユーティリティ関数

### waitFor

指定ミリ秒待機します。

```typescript
import { waitFor } from '../helpers';

await waitFor(500); // 500ms 待機
```

### retryUntil

条件が満たされるまで関数を再試行します。

```typescript
import { retryUntil } from '../helpers';

const result = await retryUntil(
  async () => await app.getObjectCount(),
  (count) => count > 0,
  { timeout: 5000, interval: 100 }
);
```

### TIMEOUTS 定数

よく使うタイムアウト値の定数。

```typescript
import { TIMEOUTS } from '../helpers';

await canvasHelper.waitForRender(TIMEOUTS.short);   // 100ms
await canvasHelper.waitForRender(TIMEOUTS.medium);  // 500ms
await canvasHelper.waitForRender(TIMEOUTS.long);    // 1000ms
await canvasHelper.waitForRender(TIMEOUTS.extended); // 5000ms
```

### TEST_DATA 定数

テストで使用するデータ定数。

```typescript
import { TEST_DATA } from '../helpers';

// TEST_DATA.defaultCellSize = 10
// TEST_DATA.defaultUnit = 'cm'
// TEST_DATA.testColor = '#333333'
// TEST_DATA.alternateColor = '#555555'
// TEST_DATA.defaultGridSize = 20
```

## グローバルセットアップ

`e2e/global-setup.ts` は全テスト実行前に1度だけ実行されます。

- 開発サーバーの起動確認
- アプリケーションの読み込み確認
- Canvas 要素の存在確認
- ページ構造（header, toolbar, footer）の確認

## ベストプラクティス

### 1. フィクスチャを活用する

```typescript
// 良い例
test('using fixtures', async ({ app, canvasHelper }) => {
  await canvasHelper.clickGrid(5, 5);
});

// 避けるべき例
test('manual setup', async ({ page }) => {
  const app = new AppPage(page);
  await app.goto();
  // ...
});
```

### 2. カスタムアサーションを使用する

```typescript
// 良い例
await customExpect.toBeInToolMode(app.page, 'draw');

// 避けるべき例
const button = app.page.getByRole('radio', { name: /描画ツール/i });
await expect(button).toHaveAttribute('aria-checked', 'true');
```

### 3. グリッド座標を使用する

```typescript
// 良い例
await canvasHelper.clickGrid(5, 5);

// 避けるべき例（ハードコードされたピクセル座標）
await app.clickCanvas(110, 110);
```

### 4. 適切な待機を行う

```typescript
// 良い例
await canvasHelper.waitForRender(TIMEOUTS.medium);

// 避けるべき例
await page.waitForTimeout(500);
```

## 関連ドキュメント

- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Page Object Model](https://playwright.dev/docs/pom)
