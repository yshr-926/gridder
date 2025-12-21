# Gridder Web

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Gridder のフロントエンドアプリケーション。グリッドベースの直感的な作図ツールを提供します。

## 概要

- **Canvas 描画**: Konva.js によるハイパフォーマンスな 2D 描画
- **リアルタイム同期**: Yjs による CRDT ベースの共同編集
- **状態管理**: Zustand によるシンプルで高速な状態管理
- **レスポンシブ UI**: Tailwind CSS によるモダンなデザイン

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| 言語 | TypeScript 5.9 |
| フレームワーク | React 19 |
| ビルドツール | Vite 7 |
| Canvas | Konva.js / react-konva |
| スタイリング | Tailwind CSS 4 |
| 状態管理 | Zustand 5 |
| CRDT | Yjs |
| テスト | Vitest + Playwright |

## 必要条件

- Node.js >= 20.0.0
- pnpm >= 8.0.0

## セットアップ

```bash
# 依存関係インストール (ルートから)
pnpm install

# 開発サーバー起動
pnpm dev
```

http://localhost:5173 でアクセスできます。

### 環境変数

```bash
cp .env.example .env
```

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `VITE_APP_ENV` | 環境 | `development` |
| `VITE_API_URL` | Backend API URL | `http://localhost:3001` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:3001/ws` |
| `VITE_DEBUG` | デバッグモード | `false` |

## 開発

### コマンド

```bash
# 開発サーバー
pnpm dev

# ビルド
pnpm build

# プレビュー (ビルド後)
pnpm preview

# リント
pnpm lint
pnpm lint:fix

# 型チェック
pnpm type-check

# フォーマット
pnpm format

# ユニットテスト
pnpm test
pnpm test:run
pnpm test:coverage

# E2E テスト
pnpm test:e2e
pnpm test:e2e:ui
pnpm test:e2e:chromium
```

### ディレクトリ構成

```
src/
├── components/       # 再利用可能な UI コンポーネント
│   ├── Canvas/          # Konva.js キャンバス関連
│   │   ├── GridCanvas.tsx
│   │   ├── GridBackground.tsx
│   │   └── GridObject.tsx
│   ├── Toolbar/         # ツールバー
│   ├── PropertyPanel/   # プロパティパネル
│   ├── Toast/           # トースト通知
│   └── ui/              # 汎用 UI (Button, Input, Modal)
├── features/         # 機能ごとのドメインロジック
│   ├── drawing/         # 描画モード
│   ├── selection/       # 選択・移動モード
│   ├── eraser/          # 消しゴム
│   ├── polygon/         # ポリゴン描画
│   ├── sync/            # Yjs 同期
│   └── export/          # エクスポート・インポート
├── hooks/            # カスタムフック
│   ├── useCanvasZoom.ts
│   ├── useKeyboardShortcuts.ts
│   └── useYjsSync.ts
├── stores/           # Zustand 状態管理
│   ├── canvasStore.ts
│   ├── collaborationStore.ts
│   └── uiStore.ts
├── types/            # TypeScript 型定義
├── utils/            # ユーティリティ関数
├── config/           # 設定
├── services/         # 外部サービス連携
├── App.tsx           # メインアプリケーション
├── main.tsx          # エントリポイント
└── index.css         # グローバルスタイル
```

## 機能

### 描画モード

| ツール | キー | 説明 |
|--------|------|------|
| 描画 | `D` | グリッド塗りつぶし |
| 選択 | `V` | オブジェクト選択・移動 |
| 消しゴム | `E` | 塗りつぶし消去 |

### キーボードショートカット

| キー | 機能 |
|------|------|
| `R` | 90度回転 |
| `Delete` | 削除 |
| `Ctrl+D` | 複製 |
| `Ctrl+Z` | 元に戻す |
| `Ctrl+Shift+Z` | やり直し |
| `Space+Drag` | パン |
| `?` | ヘルプ表示 |

## テスト

### ユニットテスト (Vitest)

```bash
# ウォッチモード
pnpm test

# 1回実行
pnpm test:run

# カバレッジ
pnpm test:coverage
```

### E2E テスト (Playwright)

```bash
# 全ブラウザ
pnpm test:e2e

# UI モード
pnpm test:e2e:ui

# 特定ブラウザ
pnpm test:e2e:chromium
pnpm test:e2e:firefox
pnpm test:e2e:webkit
```

## ビルド

```bash
# プロダクションビルド
pnpm build

# バンドル分析
pnpm build:analyze
```

出力: `dist/`

## コーディング規約

- TypeScript strict mode
- `any` 型禁止 (`unknown` を使用)
- 関数コンポーネントのみ (クラスコンポーネント禁止)
- Named export のみ (default export 禁止)

詳細は [CLAUDE.md](../../CLAUDE.md) を参照。

## ライセンス

[MIT License](../../LICENSE)
