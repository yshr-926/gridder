# Gridder

Gridder は、空間的なアイデアをグリッド上で素早く形にし、画像で共有するためのデスクトップ向けビジュアルスケッチツールです。

ラフな構想と実寸を意識したレイアウトの中間を扱います。汎用ホワイトボード、精密 CAD、画像編集ソフト、共同編集サービスは対象にしません。第一リリースはログイン不要のブラウザアプリとして動作し、バックエンドを必要としません。

## 特徴

- **グリッド頂点ポリゴン** — すべての図形をグリッド頂点にスナップした閉じたポリゴンとして保持します。矩形は 4 頂点のポリゴンで、斜辺・凹形状・穴を持てます。
- **直接操作** — 空白の左ドラッグで矩形を作り、図形内部のドラッグで移動、選択中に現れるハンドルで変形します。モード切り替えを前提にしません。
- **結合とくり抜き** — 複数図形の論理和を取る結合と、最前面の図形を型に差を取るくり抜きで自由形状を作ります。非連結になった図形は自動的に分割します。
- **実寸レイアウト** — `1 セル = 数値 + mm/cm/m` の実寸スケールを任意で設定でき、選択中の図形に幅と高さを表示します。
- **画像書き出し** — 描画範囲を PNG / JPEG へ書き出します。解像度（1x / 2x / 3x）、余白、グリッドの有無、PNG の透明背景を選べ、書き出し前にプレビューを確認できます。
- **Undo / Redo** — 文書を変更する操作をすべて Command として記録します。ドラッグ中の連続更新は確定時に 1 つの Command へまとめます。

## 必要条件

- Node.js 20 以上
- pnpm 8 以上
- Chromium 系デスクトップブラウザ（Firefox と Safari は後続の対応対象）

## セットアップ

```bash
git clone https://github.com/yshr-926/gridder.git
cd gridder
pnpm install
pnpm dev:web
```

開発サーバーは通常 [http://localhost:5173](http://localhost:5173) で起動します。

## 使い方

### 基本ワークフロー

1. 空のグリッドから開始します。
2. 空白部分を左ドラッグして矩形を作ります。
3. 図形を直接ドラッグして移動し、表示されたハンドルで変形します。
4. 必要に応じてポリゴン、結合・くり抜き、名前、実寸スケールを使います。
5. 描画範囲を確認し、JSON へ保存するか PNG / JPEG として共有します。

### マウス操作

| 操作 | 結果 |
|------|------|
| 空白を左ドラッグ | 矩形を作成 |
| 図形内部をドラッグ | グリッドにスナップしながら移動 |
| クリック | 単一選択 |
| `Shift` + クリック | 選択対象を追加・解除 |
| `Shift` + 空白ドラッグ | 範囲選択 |
| 辺上でグリッド点に近づいてドラッグ | 頂点を挿入してそのまま移動 |
| ホイール | カーソル位置を中心にズーム |
| 中ボタンドラッグ / `Space` + ドラッグ | パン |

### キーボードショートカット

| キー | 操作 |
|------|------|
| `P` | ポリゴン作成へ入る |
| `Enter` | ポリゴンを確定 |
| `Escape` | 操作を取り消す |
| `Delete` / `Backspace` | 選択図形を削除 |
| `Cmd/Ctrl` + `Z` | 元に戻す |
| `Cmd/Ctrl` + `Shift` + `Z` / `Cmd/Ctrl` + `Y` | やり直す |
| `Cmd/Ctrl` + `C` / `V` / `D` | コピー / 貼り付け / 複製 |
| `Cmd/Ctrl` + `]` / `[` | 前面へ / 背面へ |
| `Cmd/Ctrl` + `Shift` + `]` / `[` | 最前面へ / 最背面へ |
| `Cmd/Ctrl` + `G` | グループ化 |
| `Cmd/Ctrl` + `Shift` + `G` | グループ解除 |

テキスト入力中（インスペクターの名前欄など）はショートカットを無効化します。

### 保存と共有

- 通常の `.json` ファイルへ明示的に保存・読み込みします。JSON には形式バージョンを持たせますが、過去の Gridder JSON との互換性は提供しません。
- Chromium では初回に保存場所を選び、以降は同じファイルへ保存できます。
- 未保存内容はクラッシュ復元専用のドラフトとしてブラウザ内へ一時保持します。正常終了後の通常起動では自動的に開かず、異常終了後だけ復元を確認します。

## 開発

### 検証コマンド

```bash
pnpm build
pnpm lint
pnpm type-check
pnpm test
pnpm test:e2e
```

フロントエンドだけを個別に検証する場合:

```bash
pnpm --filter @gridder/web build
pnpm --filter @gridder/web lint
pnpm --filter @gridder/web type-check
pnpm --filter @gridder/web test:run
pnpm --filter @gridder/web test:e2e:chromium
```

E2E は `http://localhost:4173` の preview サーバーに対して実行します。Playwright の設定が `VITE_E2E=true pnpm run build && pnpm run preview` を自動で起動するため、通常は事前ビルドが不要です。

### 環境変数

`.env.example` をコピーして `.env` を作成します。

```bash
cp .env.example .env
```

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `VITE_APP_ENV` | 環境（development / staging / production） | `development` |
| `VITE_DEBUG` | デバッグモード | `false` |
| `VITE_APP_VERSION` | バージョン情報 | `1.0.0` |

## 技術スタック

- React 19 / TypeScript 5.9 / Vite 7
- Konva / react-konva（キャンバス描画）
- Zustand（状態管理）
- Tailwind CSS 4 / Base UI
- polygon-clipping（結合・くり抜き）
- Vitest / React Testing Library / Playwright
- pnpm workspace / Turborepo

## リポジトリ構成

```text
gridder/
├── apps/
│   └── web/                 React アプリケーション
├── packages/
│   ├── editor-core/         ポリゴン文書モデル、Command、履歴、真偽演算
│   ├── eslint-config/       ESLint 共有設定
│   └── typescript-config/   TypeScript 共有設定
└── docs/
    ├── README.md            文書の読み順と位置付け
    ├── spec.md              第一リリース仕様
    ├── adr/                 技術判断
    └── architecture/        ターゲット構成と技術調査
```

`packages/editor-core` は React やレンダラーから独立したポリゴン文書モデルを所有します。図形モデル、検証、真偽演算、Command と履歴、描画範囲、寸法、シリアライズを提供します。

## ドキュメント

- [ドキュメントガイド](docs/README.md) — 読み順と各文書の位置付け
- [ドメイン用語](CONTEXT.md)
- [第一リリース仕様](docs/spec.md)
- [ターゲットアーキテクチャ](docs/architecture/target-architecture.md)
- [UI 原則](docs/ui-principles.md)
- [Architecture Decision Records](docs/adr/)
- [エディタ技術調査](docs/architecture/editor-stack-research.md)
- [性能基準と実測値](docs/performance.md)
- [リリースワークフロー](docs/release-workflow.md)

文書間に差異がある場合は、第一リリース仕様と Accepted の ADR を優先します。`docs/plan/`、`docs/design/phase18/`、`docs/review/` はセル集合・Rust バックエンド・共同編集を前提とする旧計画であり、歴史的資料としてのみ扱います。

## 開発ガイドライン

リポジトリのワークフローと実装上の制約は [AGENTS.md](AGENTS.md) を参照してください。

## ライセンス

[MIT License](LICENSE) の下で配布されています。
