# 旧セルベース実装の撤去計画（Issue #59）

本文書は Issue #59「旧セルベース実装の撤去」の**準備調査**の成果物である。コードの削除・変更はまだ行っていない。#59 本体の着手は Issue #58（E2E テストの書き換え）の完了を待つ。

## 調査方法

- `apps/web/src/App.tsx` を起点に import を静的に辿り、実行時に到達可能かを判定した。
- `npx knip`（バージョン 6.34.0、devDependency には追加せず一時実行）で未使用ファイル・未使用 export を機械的に検出し、手動調査の裏付けとした。
- `git ls-files` / `.gitignore` を確認し、`docs/plan/`・`docs/design/`・`docs/review/` の追跡状況を確認した。

## 最重要の構造的事実

`App.tsx` は `useEditorDocument()`（`features/editor`）の戻り値を無条件に `GridCanvas` の `editorDocument` prop へ渡している。この hook は常に `EditorDocument` を返し、`undefined` にはならない。そのため `GridCanvas.tsx` の

```ts
const isEditorDocumentMode = editorDocument !== undefined; // 本番では常に true
```

という分岐は、**実行時には常に新経路（`ShapesLayer` / `EditorInteractionLayer` 等）だけを通る**。`ObjectsLayer` / `InteractionLayer` などの旧経路は `GridCanvas.tsx` から静的に import されて型検査は通るが、`else` 分岐が実行されることはない（「静的に到達可能だが実行時には死んでいるコード」）。この事実が、以下の分類の大半を決定している。

## 分類表

凡例:
- **A. 確実に未使用（安全に削除可能）** — どこからも import されていない、または `.gitignore` 済みで追跡対象外。
- **B. テストからのみ参照** — 本体コードからは呼ばれず、`*.test.ts(x)` からのみ import される。テストごと削除する。
- **C. 静的に到達可能だが実行時には死んでいる** — `GridCanvas.tsx` の `isEditorDocumentMode` の `else` 分岐、またはその配下からのみ import される。分岐を消せば A になる。
- **D. まだ実際に参照が残っている（削除前に対応が必要）** — `App.tsx` や新経路のコンポーネントから直接・間接に呼ばれ、実行時に動いている。削除するには置き換えまたは配線の変更が要る。

### `features/` 配下

| パス | 分類 | 参照元 |
|---|---|---|
| `features/drawing/`（`useDrawing`, `useSubtractionDrawing`） | C | `components/Canvas/InteractionLayer.tsx` のみ |
| `features/eraser/`（`useEraser`） | C | `components/Canvas/InteractionLayer.tsx` のみ |
| `features/polygon/usePolygonDrawing.ts` | C | `components/Canvas/InteractionLayer.tsx` のみ |
| `features/polygon/fillPolygon.ts` | **D** | `features/commands/commands/fill.ts`（Command Palette 経由で到達可能）から呼ばれる |
| `features/polygon/types.ts` | C | `PolygonPreview.tsx` / `VertexMarker.tsx`（ともに C）と `usePolygonDrawing.ts` からのみ |
| `features/selection/`（`useSelection`, `useMultiSelection`, `findObjectAtCell`） | **D** | `hooks/useCanvasKeyboard.ts` が使用し、`useCanvasKeyboard()` は `App.tsx:36` から直接呼ばれている。`InteractionLayer.tsx`（C）からも使われる |
| `features/export/exportProject.ts` | A | 自身のテスト以外に importer なし |
| `features/export/importProject.ts` | A | 同上 |
| `features/export/autoSave.ts` | A | 同上（#54/#55 で `features/file` / `features/draft` に置換済み） |
| `features/export/exportImage.ts` | A | 同上（#46 で `features/export-image` に置換済み） |
| `features/export/validation.ts` | A | 同上 |
| `features/export/types.ts` | A | 同上 |
| `features/export/index.ts` | A | knip も「未使用ファイル」として検出 |
| `features/commands/`（`executor.ts`, `parser.ts`, `commands/*`, `history.ts`, `types.ts`） | **D**（削除は要合意） | `hooks/useCommandExecutor.ts` 経由で `components/CommandPalette` から到達可能。`App.tsx:9,152` が `CommandPalette` を描画する |
| `features/index.ts` | A | knip が未使用ファイルと検出（drawing/eraser/selection を再 export するだけの孤立バレル） |

### `stores/` 配下

| パス | 分類 | 参照元 |
|---|---|---|
| `stores/canvasStore.ts`（cells ベース） | **D** | `useCanvasKeyboard`・`useCommandExecutor`（Command Palette）・`useSentryContext` から実行時に到達。表示には使われないが状態は変更され続ける |
| `stores/groupStore.ts` | **D** | `useCanvasKeyboard.ts`（Ctrl+G / Ctrl+Shift+G）から到達 |
| `stores/historyStore.ts` | **D** | `useCommandExecutor`（Command Palette）から到達 |
| `stores/gridSettingsStore.ts` | **一部生存（削除不可）** | `GridCanvas.tsx:5` が `basePixelSize` を新経路でも直接参照している。ファイル内に `// TODO(#59): Toolbar/StatusBar の移行後に互換同期を削除する。` と自己申告あり。**ストア全体は残し、旧 UI 専用フィールド・互換同期コードだけを削る** |
| `stores/uiStore.ts` | A（実質） | `DimensionDisplaySettings.tsx` / `TextDisplaySettings.tsx`（ともに A）と `GridObjectShape.tsx`（C）からのみ。レンダーツリーには到達しない |
| `stores/selectors.ts` | A | 呼び出し箇所ゼロ（`stores/index.ts` からの export のみ） |
| `stores/index.ts` | 変更要 | 上記削除に合わせて対応する export 行を削る（新実装分の export は残す） |
| `stores/viewportStore.ts` 内の互換フィールド | **一部生存（削除不可）** | ファイル内 `// TODO(#59): viewportStore への移行完了後に読み取り互換フィールドを削除する。` と自己申告あり。ストア自体は新経路で現役 |

### `components/` 配下

| パス | 分類 | 参照元 |
|---|---|---|
| `components/Toolbar/` | A | `components/index.ts`（自身も A）以外に importer なし。テストファイルすら存在しない |
| `components/StatusBar/` | A | 同上 |
| `components/index.ts` | A | knip が未使用ファイルと検出。全体が孤立バレル |
| `components/PropertyPanel/ObjectNameEditor.tsx` | A | `PropertyPanel/index.ts` からの re-export のみ。`PropertyPanel.tsx` 本体は import していない。テストも無し |
| `components/PropertyPanel/DecorationSettings.tsx` | A | 同上 |
| `components/PropertyPanel/TextDisplaySettings.tsx` | A | 同上 |
| `components/PropertyPanel/DimensionDisplaySettings.tsx` | A | 同上 |
| `components/PropertyPanel/GroupPanel.tsx` | B | `GroupPanel.test.tsx` からのみ参照。`PropertyPanel.tsx` 本体は import していない |
| `components/PropertyPanel/index.ts` | 変更要 | 既に `// Retired canvasStore-bound sections; removed with the cell UI in #59.` というコメント付きで上記 5 件を export している。削除時にこの5行とコメントを削る |
| `components/HelpText/`（`PolygonHelp.tsx`） | B | `PolygonHelp.test.tsx` からのみ。新しい `EditorInteractionLayer` 系はポリゴン作成のヘルプ文言を持たない（新規に用意するか、意図的に無しとするかは別 issue） |
| `components/FileOperations/`（`ImportDialog.tsx`, `FileDropZone.tsx`） | B | `components/index.ts`（A）と各自のテストのみ。#54 の `features/file` に置換済み |
| `components/Canvas/GridObjectShape.tsx` | C | `ObjectsLayer.tsx` のみ |
| `components/Canvas/ObjectsLayer.tsx` | C | `GridCanvas.tsx` の `else` 分岐 |
| `components/Canvas/InteractionLayer.tsx` | C | `GridCanvas.tsx` の `else` 分岐 |
| `components/Canvas/CursorOverlay.tsx` | C | `InteractionLayer.tsx` のみ |
| `components/Canvas/DimensionLabel.tsx` | C | `GridObjectShape.tsx` のみ（新しい `components/Canvas/DimensionLayer/` とは別物なので混同注意） |
| `components/Canvas/ObjectTextLabel.tsx` | C | `GridObjectShape.tsx` のみ |
| `components/Canvas/PolygonPreview.tsx` | C | `InteractionLayer.tsx` のみ |
| `components/Canvas/VertexMarker.tsx` | C | `PolygonPreview.tsx` のみ（孤立クラスタの中でさらに1段深い） |
| `components/Canvas/index.ts` | 変更要 | `ObjectsLayer` / `GridObjectShape` / `InteractionLayer` / `VertexMarker` / `PolygonPreview` / `CursorOverlay` の export 行を削る。新経路の export は残す |
| `components/CommandPalette/` | **D（削除は要合意）** | `App.tsx:9,152` が直接 import・描画する。Ctrl/Cmd+Shift+P で開く現役機能 |

### `packages/shared-types`

| 対象 | 分類 | 参照元 |
|---|---|---|
| `GridObject` | **D の配下でのみ使用** | `apps/web/src/types/index.ts` 経由で `features/{drawing,eraser,polygon,selection}`・`features/commands`・`features/export`（A）・`stores/{canvasStore,historyStore}`・`components/Canvas` の旧コンポーネント（C）・`components/PropertyPanel` の旧コンポーネント（A）でのみ使用。新経路（`ShapesLayer`, `features/editor`）は `@gridder/editor-core` 独自の型を使い `shared-types` を参照しない |
| `ProjectData` / `GridSettings`（型） | A の配下でのみ使用 | `features/export/*`（A）と `components/FileOperations/ImportDialog.tsx`（B）のみ |
| `Position`, `CellCoordinate`, `Rotation`, `ObjectDecoration`, `Unit`, `LengthUnit` | 上記の配下 | 同上の連鎖でのみ使用 |

**結論**: `packages/shared-types` は、旧セルベース実装（A/B/C/D の cell 系）と Command Palette の裏側でしか使われていない。旧実装と Command Palette の両方を退役させた時点で、パッケージ全体を削除できる。それまでは残す。

### Sentry / web-vitals / analytics（削除を推奨、最終判断は人間に委ねる）

`docs/spec.md` §13（技術構成）に Sentry・web-vitals・Plausible Analytics の記載は無い。以下は削除時の影響整理であり、削除の可否そのものは人間の判断を仰ぐ。

| 項目 | 現状 | 削除した場合の影響 |
|---|---|---|
| `@sentry/react`（package.json 依存） | `apps/web/package.json` の dependencies | `config/sentry.ts`, `hooks/useSentryContext.ts`, `components/ErrorBoundary.tsx`, `hooks/usePerformanceMetrics.ts`, `config/webVitals.ts` から import。全て削除または Sentry 抜きの代替実装が必要 |
| `@sentry/vite-plugin`（package.json devDependency 相当） | `apps/web/vite.config.ts` で `sentryVitePlugin(...)` を条件付きで plugins に追加、`manualChunks` に `sentry: ['@sentry/react']` の設定あり | `vite.config.ts` の該当ブロック（`getSentryPlugin`、`manualChunks.sentry`）を削除 |
| `web-vitals`（package.json 依存） | `config/webVitals.ts` が `onCLS/onFCP/onINP/onLCP/onTTFB` を import。`main.tsx` の `initializeApp()` がブートストラップ時に `initWebVitals()` を呼ぶ（React ツリーの外） | `main.tsx` の該当呼び出しと `config/webVitals.ts` を削除 |
| Plausible Analytics（`config/analytics.ts`） | `main.tsx` が `window.plausible` の有無をチェックしてセッション開始イベントを送る。`index.html` にスクリプトタグで読み込む想定（現状は未設定） | `main.tsx` の該当ブロックと `config/analytics.ts` を削除。`index.html` に Plausible の script タグがあれば合わせて確認 |
| 環境変数 | `VITE_SENTRY_DSN`（`apps/web/.env.production` にコメントアウトで記載）、`VITE_PLAUSIBLE_DOMAIN`（同）、`SENTRY_AUTH_TOKEN`（CI/ビルド時、vite.config.ts が参照） | 現状どちらも未設定（コメントアウト）のため、本番ビルドでも Sentry は `isSentryInitialized() === false` のまま動いていないと推測される。削除時は `.env.production` の該当コメント行・CI の `SENTRY_AUTH_TOKEN` シークレット設定（存在すれば）も確認する |
| `useSentryContext`（`App.tsx:39` から直接呼ばれる） | `stores/canvasStore` / `stores/gridSettingsStore` の cell ベースの値（`objects`, `toolMode`, `selectedObjectId` 等）を Sentry コンテキストとして送信している | Sentry を残す場合でも、この hook は新しい `EditorDocument` を見ておらず実質意味のない情報を送っている。**Sentry の可否によらず、少なくともこの hook は editor-core ベースへ書き換えるか削除する必要がある** |

補足: 現状 DSN が未設定のため、これらは実運用上は「何もしていないコード」である可能性が高いが、`useSentryContext` は毎レンダー実行され `canvasStore`/`gridSettingsStore` への依存を生み続けている点だけは Sentry の存廃と関係なく解消すべき。

### CommandPalette / features/commands（削除を推奨、最終判断は人間に委ねる）

`docs/spec.md` §12（UI構成）・§13 に Command Palette の記載は無い。以下は削除時の影響整理であり、削除の可否そのものは人間の判断を仰ぐ。

- **参照箇所**: `App.tsx`（import・レンダー・Ctrl/Cmd+Shift+P のトグル state）、`hooks/useCommandExecutor.ts`、`hooks/useUndoRedo.ts`（`useCommandExecutor` 経由、他に呼び出し元なし）。
- **依存する旧ストア**: `stores/canvasStore.ts`（`rect`/`fill`/`line` コマンドが直接編集）、`stores/historyStore.ts`（`undo` コマンド）、`stores/gridSettingsStore.ts`。
- **依存パッケージ**: 追加の外部パッケージ依存は無い（Base UI の Popover 等、既存 UI ライブラリのみ使用）。
- **package.json**: Command Palette 専用の依存は見当たらない。
- **vite 設定**: 特記事項なし。
- **削除した場合の影響**: `App.tsx` から `CommandPalette` の import・JSX・Ctrl+Shift+P の `useEffect`・`isCommandPaletteOpen` state を削除する。`hooks/useCommandExecutor.ts` と `hooks/useUndoRedo.ts`（後者は他に呼び出し元がないため道連れで削除可）も削除対象になる。これにより `stores/canvasStore.ts` / `groupStore.ts` / `historyStore.ts` への最後の実行時参照が消え、旧ストア群を安全に削除できるようになる。
- **残す場合**: editor-core ベースへの書き換え（`EditorDocument` を操作するコマンドとして再実装）が必要。現状の実装のままでは「表示されない cell モデルを操作するだけの機能」であり、ユーザーに見える効果が無い。

### `docs/plan/`・`docs/design/phase18/`・`docs/review/`（対応不要・確認のみ）

`git ls-files` で確認した結果、これら3ディレクトリは**既に Git の追跡対象から外れている**（`.gitignore` の 57〜59 行目に `docs/plan/`, `docs/design/`, `docs/review/` が登録済み）。`docs/README.md` にも「歴史的文書（参照のみ）」として明記され、Git 追跡対象外である旨が書かれている。

**結論**: Issue #59 のこの項目はリポジトリ上は既に完了している。ローカルの作業ツリーにファイル実体が残っていても、それは各自の環境の話であり、削除計画としての対応は不要。

## 削除順序（実装フェーズ、#58 完了後）

コード削除は複数worker が同じファイルを触るため、依存の浅いものから段階的に進める。各ステップ後に `pnpm build && pnpm lint && pnpm type-check && pnpm test` を通す。

1. **A（確実に未使用）を機械的に削除**
   - `features/export/*`、`features/index.ts`、`components/index.ts`、`components/Toolbar/`、`components/StatusBar/`、`components/PropertyPanel/{ObjectNameEditor,DecorationSettings,TextDisplaySettings,DimensionDisplaySettings}.tsx`、`stores/selectors.ts`、`stores/uiStore.ts`（実質未到達を再確認の上）。
   - `components/PropertyPanel/index.ts` から該当4行と「Retired」コメントを削る。
   - **検証**: `pnpm build && pnpm lint && pnpm type-check && pnpm test`。ビルドが通ることで「本当に未参照だった」ことを再確認する。

2. **B（テストからのみ参照）をテストごと削除**
   - `components/PropertyPanel/GroupPanel.tsx` + `GroupPanel.test.tsx`。
   - `components/HelpText/`（`PolygonHelp.tsx` + テスト）。ただし削除前に、新しい `EditorInteractionLayer` 側にポリゴン作成のヘルプ文言が本当に不要か確認する（ui-principles §2 の「不慣れな操作の可視化」要件との整合）。
   - `components/FileOperations/`（`ImportDialog.tsx`, `FileDropZone.tsx` + テスト）。
   - **検証**: 同上。加えて該当機能の代替（#54 の `features/file`）が UI 上から到達可能なことを手動確認する。

3. **`GridCanvas.tsx` の `isEditorDocumentMode` 分岐を除去し、C を A に変換**
   - `editorDocument` を必須 prop にし、`isEditorDocumentMode` 三項演算子と `else` 側の JSX を削除。
   - これにより `ObjectsLayer`, `InteractionLayer`, `GridObjectShape`, `DimensionLabel`, `ObjectTextLabel`, `PolygonPreview`, `VertexMarker`, `CursorOverlay` と、それらだけが使う `features/drawing`, `features/eraser`, `features/polygon`（`fillPolygon.ts` を除く。下記参照）が真に未使用になる。
   - `components/Canvas/index.ts` から該当 export を削る。
   - **検証**: `pnpm build && pnpm lint && pnpm type-check && pnpm test`。加えて Playwright で矩形作成・選択・移動・伸縮・ポリゴン作成の主要シナリオを実行し、新経路だけで画面が壊れていないことを確認する。

4. **CommandPalette と features/commands の扱いを決定**（人間の判断待ち。合意後に実施）
   - 削除する場合: `App.tsx` から `CommandPalette` 関連の import・state・JSX を削除 → `hooks/useCommandExecutor.ts`, `hooks/useUndoRedo.ts` を削除 → `components/CommandPalette/`, `features/commands/` を削除。
   - 残す場合: `editor-core` ベースで書き直すチケットを別途起票する。
   - このステップの完了後、`features/polygon/fillPolygon.ts` への最後の実行時参照が消えるため、`features/polygon/` 全体が A になる。
   - **検証**: 同上。

5. **`features/selection/` と `stores/canvasStore.ts` / `groupStore.ts` / `historyStore.ts` の扱いを決定**
   - ステップ4完了後、これらへの実行時参照は `hooks/useCanvasKeyboard.ts` だけになる。
   - `useCanvasKeyboard.ts` は `App.tsx` から呼ばれている旧キーボードショートカット（D/V/E/P/L/M/R キーでのツールモード切替、Ctrl+G グループ化等）で、新しい `features/editor` 側のショートカット（`useRotateShortcut` の `R` キー等）と**キーコードが競合している**（例: `R` キーは新実装では時計回り回転、旧実装では旧オブジェクトの回転）。削除ではなく、まず `App.tsx` から `useCanvasKeyboard()` 呼び出しを外す（または新実装のショートカットだけを残す形に書き換える）作業が必要。
   - `useCanvasKeyboard()` の呼び出しを外した後、`features/selection/`, `stores/canvasStore.ts`, `stores/groupStore.ts` への実行時参照は無くなる。
   - `stores/historyStore.ts` はステップ4で最後の参照が消える。
   - `stores/gridSettingsStore.ts` は全体を消さず、`// TODO(#59)` コメントが付いている互換フィールド・同期コードだけを削る（`basePixelSize` 等、新経路が使うフィールドは残す）。同様に `stores/viewportStore.ts` の互換フィールドも削る。
   - **検証**: 同上。加えて、新実装のキーボードショートカット一覧（R, Ctrl+C/V/D, Delete, Ctrl+]/[ 等）が引き続き正しく動作することを手動確認する。

6. **Sentry / web-vitals / analytics の扱いを決定**（人間の判断待ち。合意後に実施）
   - `hooks/useSentryContext.ts` は Sentry の存廃に関わらず editor-core ベースに書き換えるか削除する（旧 canvasStore の値を送り続けている問題を解消するため）。
   - 削除する場合: `main.tsx` の初期化コード、`config/sentry.ts`, `config/webVitals.ts`, `config/analytics.ts`, `hooks/useSentryContext.ts`、`components/ErrorBoundary.tsx` の Sentry 連携部分を削除。`package.json` から `@sentry/react`, `@sentry/vite-plugin`, `web-vitals` を削除し `pnpm install` でロックファイルを更新。`vite.config.ts` の `getSentryPlugin`・`manualChunks.sentry` を削除。`.env.production` のコメント行、CI の `SENTRY_AUTH_TOKEN` シークレットも確認・整理する。
   - 残す場合: `useSentryContext` を editor-core ベースで書き直すチケットを別途起票する。
   - **検証**: `pnpm build`（Sentry プラグイン抜きでビルドが壊れないこと）、本番相当ビルドでエラーが出ないこと。

7. **`GridObject` / `ProjectData` を含む `packages/shared-types` の扱いを決定**
   - ステップ4・5が完了し、旧セルベース実装と Command Palette が両方退役した時点で、`shared-types` の全型が未使用になる。
   - `apps/web/src/types/index.ts` の re-export、`packages/shared-types` パッケージ全体、`apps/web/package.json` の `@gridder/shared-types` 依存を削除する。
   - **検証**: `pnpm build && pnpm lint && pnpm type-check && pnpm test`（monorepo 全体）。

8. **最終確認**
   - `npx knip` を再実行し、未使用 export・未使用ファイル・未使用依存が無いことを確認する。
   - `CONTEXT.md` の Avoid 語（「オブジェクト」「キャンバス」等）がコード上の主要な識別子（型名・コンポーネント名・関数名）に残っていないか `grep -rn` で確認する。
   - `docs/README.md` の「歴史的文書」節が実情と合っているか再確認する（`docs/plan/` 等は既に対応済みのため変更不要のはず）。

## 前提条件・ブロッカー

- **Issue #58（E2E テストの書き換え）待ち**: `apps/web/e2e/` 配下に `Toolbar`/`StatusBar` 等の旧 UI を前提にしたテスト・ヘルパーが残っている（例: `global-setup.ts`, `accessibility/a11y.spec.ts`, `helpers/README.md`）。これらが新 UI 向けに書き換わるまで、旧コンポーネントを削除すると E2E が壊れる。
- **`useCanvasKeyboard` とのキー競合**: ステップ5で触れた通り、旧ショートカットと新ショートカットが同じキーを取り合っている。削除より先に競合の解消（どちらを残すかの判断）が要る。

## 実行したコマンドと結果（今回の調査のみ、削除は未実施）

```
npx knip                 # 未使用 export 一覧（apps/web/src, packages/shared-types 含む）を取得
npx knip --include files # 未使用ファイル一覧（17件）を取得
git ls-files docs/plan/ docs/design/phase18/ docs/review/   # いずれも 0 件（.gitignore 済み）
```

`pnpm build && pnpm lint && pnpm type-check && pnpm test` は今回コードを変更していないため実行していない（実装フェーズの各ステップで実行する）。
