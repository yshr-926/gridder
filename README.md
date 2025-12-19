# Gridder

[![CI](https://github.com/yshr-926/gridder/actions/workflows/ci.yml/badge.svg)](https://github.com/yshr-926/gridder/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yshr-926/gridder/branch/main/graph/badge.svg)](https://codecov.io/gh/yshr-926/gridder)

グリッドベース簡易作図Webアプリケーション

## 概要

Gridder は、グリッド（方眼）を塗りつぶして直感的に図形を作成・配置できるツールです。厳密なCADを使うほどではないが、寸法を意識した配置図や概念図を作りたいユーザー向けに設計されています。

### 主な用途

- 部屋の模様替えや家具の配置シミュレーション
- イベント会場のブース割り当て
- DIYのための簡易設計図作成

## 機能

### 描画モード

- **描画ツール (D)**: グリッド上をクリック/ドラッグして塗りつぶし
- **選択ツール (V)**: オブジェクトを選択・移動・回転
- **消しゴム (E)**: 塗りつぶしを消去

### キャンバス操作

- **ズーム**: マウスホイールで拡大/縮小
- **パン**: Spaceキー + ドラッグで視点移動

### データ管理

- **JSON保存**: プロジェクトをJSONファイルとして保存
- **画像出力**: PNG/JPEG形式で画像をエクスポート
- **自動保存**: 作業内容は自動的にブラウザに保存

## キーボードショートカット

| キー | 機能 |
|------|------|
| D | 描画モード |
| V | 選択モード |
| E | 消しゴム |
| R | 90度回転 |
| Delete / Backspace | 削除 |
| Ctrl/Cmd + D | 複製 |
| Ctrl/Cmd + Z | 元に戻す |
| Ctrl/Cmd + Shift + Z | やり直し |
| Arrow Keys | 選択オブジェクトを移動 |
| Space + Drag | キャンバスをパン |
| ? | ショートカットヘルプを表示 |

## 開発

### セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env

# 開発サーバーの起動
npm run dev
```

### 環境変数

環境変数は `.env.example` をコピーして `.env` ファイルを作成し、必要に応じて値を設定してください。

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|-------------|------|
| `VITE_APP_ENV` | 環境（development/staging/production） | `development` | No |
| `VITE_DEBUG` | デバッグモード（true/false） | `false` | No |
| `VITE_APP_VERSION` | アプリケーションバージョン | `0.0.0` | No |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics Measurement ID | - | No |
| `VITE_SENTRY_DSN` | Sentry DSN（エラートラッキング） | - | No |

### コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# ビルド後のプレビュー
npm run preview

# テスト実行
npm run test

# テスト実行（1回）
npm run test:run

# リント
npm run lint

# リント（自動修正）
npm run lint:fix

# 型チェック
npm run type-check

# フォーマット
npm run format
```

### ディレクトリ構成

```
src/
├── components/           # 再利用可能なUIコンポーネント
│   ├── Canvas/          # Konva.jsキャンバス関連
│   ├── Toolbar/         # ツールバー
│   ├── PropertyPanel/   # プロパティパネル
│   ├── Toast/           # トースト通知
│   └── ui/              # 汎用UIコンポーネント
├── features/            # 機能ごとのドメインロジック
│   ├── drawing/         # 描画モード機能
│   ├── selection/       # 選択・移動モード機能
│   ├── eraser/          # 消しゴム機能
│   └── export/          # エクスポート・インポート機能
├── hooks/               # カスタムフック
├── stores/              # Zustand状態管理
├── types/               # TypeScript型定義
├── utils/               # ユーティリティ関数
└── App.tsx              # メインアプリケーション
```

## 技術スタック

- **フレームワーク**: React 19 + TypeScript
- **ビルドツール**: Vite
- **描画ライブラリ**: Konva.js (react-konva)
- **状態管理**: Zustand
- **スタイリング**: Tailwind CSS

## ブラウザサポート

- Google Chrome（最新版）
- Firefox（最新版）
- Safari（最新版）
- Edge（最新版）

## コーディング規約

詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。

### 主なルール

- TypeScript strict mode を使用
- `any` 型の使用禁止（`unknown` を使用）
- クラスコンポーネント禁止（関数コンポーネントのみ）
- Named export を使用（default export 禁止）

## ライセンス

MIT
