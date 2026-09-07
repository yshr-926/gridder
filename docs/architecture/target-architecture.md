# Gridder ターゲットアーキテクチャ

この文書は、第一リリースに向けた実装責務と依存方向を定める。プロダクトの振る舞いは [第一リリース仕様](../spec.md)、用語は [CONTEXT.md](../../CONTEXT.md)、個別の技術判断は [ADR](../adr/) を正とする。

## 基本方針

- `packages/editor-core` の framework-free TypeScript をスケッチ文書の正規ソースにする。
- 文書の変更は Command として実行し、確定済みの変更だけを Undo / Redo 履歴へ積む。
- React と Zustand は選択、ビューポート、パネル、操作中のプレビューなど UI の一時状態だけを持つ。
- Konva / react-konva は描画とポインター入力の Adapter とし、一つの図形を一つのポリゴンノードとして描画する。
- ポリゴン論理演算とブラウザのファイル API は、外部実装を交換できる狭い Adapter の内側へ閉じ込める。
- ネットワーク、共同編集、レンダラー固有型、ブラウザ API を文書モデルへ含めない。

## パッケージと責務

```text
apps/web
├── React DOM UI
│   └── 上部バー、インスペクター、ダイアログ
├── Zustand UI state
│   └── 選択、ビューポート、パネル、現在の操作とプレビュー
├── interaction / application layer
│   └── pointer arbitration、座標変換、Command の開始と確定
└── adapters
    ├── Konva renderer / pointer input
    ├── polygon boolean implementation
    └── browser file access
             │
             │ Command、query、domain type
             ▼
packages/editor-core
├── document model と不変条件
├── Command と Undo / Redo 履歴
├── grid geometry の純粋な変換
└── 外部処理に必要な狭い port

packages/shared-types
└── 旧セルベース実装の移行中だけ残す型。新しい正規モデルにはしない
```

依存は `apps/web` から `packages/editor-core` への一方向とする。`editor-core` は React、Zustand、Konva、DOM、ブラウザ API、ネットワーク実装を import しない。外部処理が必要な場合は `editor-core` が要求する小さな port を定義し、`apps/web` の Adapter が実装を注入する。

React コンポーネントは文書を直接変更せず、application layer を通して Command を実行する。Renderer Adapter は文書の snapshot と UI の一時状態を入力として描画し、Konva node tree を永続化しない。

## 状態の境界

| 分類 | 所有者 | 含むもの | 保存と履歴 |
|---|---|---|---|
| 永続状態 | `packages/editor-core` | 形式バージョン、整数グリッド頂点の図形と穴、名前、スタイル、前後関係、一階層のグループ、描画範囲、任意の実寸スケール | JSON へ保存する。変更は Command を経由する |
| 履歴状態 | `packages/editor-core` | 確定済み Command の Undo / Redo スタック | 実行中だけ保持し、JSON へ保存しない |
| 一時状態 | `apps/web` の Zustand と interaction layer | 選択、hover、ビューポート、パネル、pointer capture、drag 開始点、preview geometry、操作ハンドル | JSON と Undo / Redo の対象外 |
| レンダラー固有状態 | `apps/web` の Renderer Adapter | Konva node ref、Transformer、hit graph、描画 cache | 文書モデルへ戻さず、保存も履歴化もしない |

未保存フラグは永続状態と保存済み snapshot の差から導出する。復元用ドラフトは永続形式と同じ文書データを一時保管する保存 Adapter の責務であり、選択やビューポートを混ぜない。

ビューポートの変換（パン、ズーム）は一時状態として Zustand が持つが、描画への適用は Renderer Adapter がストアの購読から Konva Stage の変換として直接行う。React コンポーネントは `offset` を購読せず、ポインター座標の変換はイベント時にストアを読む（[ADR-0005](../adr/0005-konva-rendering-performance-rules.md)）。

## 操作の流れ

```text
pointer / keyboard event
        │
        ▼
interaction layer ── preview 更新 ──▶ Zustand UI state
        │ gesture end
        ▼
      Command
        │
        ▼
editor-core ── new document snapshot ──▶ Renderer Adapter
        │
        └── Undo / Redo history に 1 件追加
```

ドラッグや伸縮の途中では React の文書状態を毎フレーム更新しない。interaction layer が一時的な preview を更新し、gesture 終了時に正規化済みの整数 grid geometry を一つの Command として commit する。パンとズームは文書を変更しないため Command にせず、履歴にも含めない。

## Adapter 境界

- **Renderer / pointer input**: screen・world・grid 座標を変換し、入力イベントをアプリケーションが扱う意図へ変換する。文書の意味や Undo / Redo を判断しない。
- **Polygon boolean**: Gridder の polygon / multipolygon と外部ライブラリの型を相互変換する。退化辺、向き、重複頂点、非連結結果を正規化してドメイン型で返す。
- **Browser file access**: 開く、保存、ダウンロードのブラウザ差異を吸収する。文書の serialize / validate は `editor-core` の責務とする。

共同編集を将来追加する場合も、正規の文書型と Command の意味を維持し、ネットワーク同期を Adapter として接続する。第一リリースの実行経路にサーバーやログインを追加しない。
