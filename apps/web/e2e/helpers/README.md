# Gridder E2E Test Helpers

多角形ドキュメント UI（issue #58）向けの E2E ヘルパー。旧セルベース UI 前提の
ツールモード / トグルバーは存在しない — すべてキャンバス上の直接操作。

## ディレクトリ構成

```
e2e/helpers/
├── index.ts          # すべてのヘルパーを再エクスポート
├── canvas.ts          # CanvasHelper: グリッド座標 <-> スクリーン座標変換とジェスチャー
├── editorState.ts      # editor-core ランタイム（window.__GRIDDER_*）の読み取り
├── setup.ts            # カスタムテストフィクスチャ（page / canvasHelper）
├── assertions.ts        # 汎用アサーションヘルパー
└── README.md            # このドキュメント
```

## 基本的なインポート

```typescript
import { test, expect, readDocument, readSelection } from '../helpers';
```

## `canvasHelper` フィクスチャ（`CanvasHelper`）

グリッド頂点 <-> スクリーン座標の変換は、ズームとパンの度に変わる
`window.__GRIDDER_VIEWPORT_STORE__`（`scale` / `offset`）を都度読んで計算する。
そのため、ズームしていてもテストコード側はグリッド座標だけを指定すればよい。

```typescript
test('example', async ({ canvasHelper }) => {
  await canvasHelper.dragGrid(2, 2, 7, 6); // 空白ドラッグで矩形作成
  await canvasHelper.clickGrid(4, 4); // グリッド頂点をクリック
  await canvasHelper.doubleClickGrid(4, 4); // グループ内モード / セル編集へ
  await canvasHelper.wheelAtGrid(4, 4, -100); // カーソル中心ズーム
  await canvasHelper.middleDragPan(200, 200, 80, 40); // 中ボタンパン
});
```

主なメソッド:

| メソッド | 説明 |
|---------|------|
| `gridToScreen(x, y)` / `screenToGrid(x, y)` | 座標変換（テスト内で独自計算が必要な場合） |
| `clickGrid(x, y, { modifiers })` | グリッド頂点をクリック（Shift 等の修飾キー対応） |
| `doubleClickGrid(x, y)` | ダブルクリック（グループ内モード / セル編集） |
| `dragGrid(x1, y1, x2, y2, { shiftKey, altKey, steps })` | ドラッグ（範囲選択・セル編集の Alt 削除に対応） |
| `hoverGrid(x, y)` | ホバーのみ |
| `wheelAtCenter(deltaY)` / `wheelAtGrid(x, y, deltaY)` | ホイールズーム |
| `middleDragPan(x, y, dx, dy)` | 中ボタンドラッグパン |
| `getViewport()` | 現在の `{ scale, offset }` |
| `waitForCanvas()` | Canvas 要素の準備を待機 |

**ダブルクリック誤判定への対策**: `clickGrid` / `dragGrid` はジェスチャー完了後に
約500msの待機を内蔵している。ブラウザは離れた座標同士の `mousedown`/`mouseup`
であっても短い間隔で連続すると `dblclick` と判定することがあり、このアプリの
キャンバスはダブルクリックを「グループ内モードへ入る」「セル編集へ入る」と
解釈するため、対策なしでは次のテスト操作がセル編集モードに迷い込む。

## `editorState.ts`: editor-core ランタイムの読み取り

`VITE_E2E=true` ビルドでのみ `window.__GRIDDER_EDITOR_SESSION__` /
`__GRIDDER_SELECTION_STORE__` / `__GRIDDER_VIEWPORT_STORE__` が公開される
（`useEditorSession.ts` / `selectionStore.ts` / `viewportStore.ts`）。

```typescript
import { readDocument, readSelection } from '../helpers';

test('example', async ({ page, canvasHelper }) => {
  await canvasHelper.dragGrid(2, 2, 7, 6);

  const document = await readDocument(page);
  // document.shapeCount / document.shapes（z-order順）/ document.zOrder
  // document.canUndo / document.canRedo / document.groupCount

  const selection = await readSelection(page);
  // selection.selectedIds / selection.primaryId / selection.activeGroupId
});
```

## アサーション（`assertions.ts`）

| 関数 | 説明 |
|------|------|
| `expectModalVisible(page, titlePattern?)` | ダイアログが表示されていることを確認 |
| `expectNoModal(page)` | ダイアログがないことを確認 |
| `expectNoConsoleErrors(page, action)` | 操作中に想定外の console エラーが出ないことを確認 |

## ベストプラクティス

- 座標は必ず `CanvasHelper` 経由のグリッド座標で指定する（ハードコードした
  ピクセル座標や `page.mouse` の直接呼び出しは避ける） — ズーム率に依存しない。
- 図形の中心が水平/垂直方向で 1 セルしかない（辺との距離がちょうど
  `handleHitRadius` に一致する）座標でのクリックは、伸縮ハンドルの当たり判定と
  衝突しうるので避ける。
- `readDocument` / `readSelection` で状態を確認する。`expect.poll` と組み合わせ、
  `waitForTimeout` によるポーリングは避ける。
- Undo/Redo のショートカットは `<input>` にフォーカスがある間は無効（名前欄で
  Ctrl+Z を打っても発火しない）。チェックボックスなど `<input>` にフォーカスが
  残ったままの操作の後は `element.evaluate(el => el.blur())` 等で明示的に外す。

## グローバルセットアップ

`e2e/global-setup.ts` は全テスト実行前に1度だけ実行され、開発/プレビュー
サーバーの起動とページ読み込みを確認する。

## 関連ドキュメント

- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
