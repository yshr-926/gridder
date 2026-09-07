# ADR 0005: Konva 描画の性能規約（perfectDraw 無効化とビューポート変換の React 外適用）

- Status: Accepted
- Date: 2026-09-07

## Context

spec §14 は基準データ（約 500 図形・50,000 セル）でパン、ズーム、移動、矩形伸縮を継続的に操作できることを求め、`docs/performance.md` §4 はそれをフレーム時間 p95 16.7ms 以下・入力遅延 50ms 以下と定める。issue #61 の計測では基準データのパンが p95 188ms で、DevTools での計測すら困難だった。

原因は二つあった。

1. Konva は fill と stroke を持ち opacity < 1 の Shape を、既定（`perfectDrawEnabled: true`）ではレイヤー全体のバッファキャンバスへ描いてから合成する。境界線と塗りの重なりを厳密に一度だけ描くための挙動だが、500 図形分の全画面合成が毎フレーム GPU 側で走り、1 フレーム約 93ms を占めていた。JS プロファイルにも Long Task にも現れないため、React 側の最適化だけでは到達できない下限になっていた。
2. `GridCanvas` がビューポートの `offset` / `scale` を購読していたため、パン・ズームの毎フレームで図形ノード 1,000 個を含む React ツリーが再レンダリングされていた。

## Decision

- 図形ポリゴン（`ShapePolygon`）は `perfectDrawEnabled` を無効にする。半透明図形の境界線の内側半分が塗りとブレンドされてわずかに濃くなるサブピクセル幅の差を、基準データが操作可能であることより優先度の低い品質差として受け入れる。共有画像も同じ描画経路なので同じ差が出る。
- ビューポートのパンとズームは Konva Stage の変換として扱い、`viewportStore` の購読から Stage へ直接適用する（`useStageViewport`）。React コンポーネントは `offset` を props や購読で受け取らない。ポインター座標の変換はイベント時にストアを読む（`readViewportTransform`）。`scale` の購読は、ズーム不変の見た目（注釈、選択枠、ハンドル、グリッド線の太さ）を持つコンポーネントに限る。
- 図形ごとの描画コンポーネント（`ShapesLayer` 配下）は memo 化し、操作中のプレビューは図形単位の安定した値に解決してから渡す。React 19 でも Konva という外部ライブラリ統合のため、手動メモ化の例外として扱う。
- 性能判断は `docs/performance.md` の手順で、本番相当ビルド（`VITE_E2E=true`）のヘッドあり Chrome で行う。React 開発ビルドの数値は当たりを付ける用途に限る。

## Consequences

- 基準データで、判定環境のフレーム p95 はパン 10.0ms、ズーム 8.2ms、移動 5.1ms、矩形伸縮 5.8ms になり、合格ラインを満たす（`docs/performance.md` §7）。
- 共有画像用の `ExportStage` の再描画が約 4 秒から 18ms になり、文書コミット後の停止がなくなる。
- 半透明図形の境界線が理論上の「一度だけ描く」結果と一致しなくなる。境界線の色と太さはテーマ固定（spec §8）なので、差は全図形で一様である。
- Renderer Adapter の状態境界（`docs/architecture/target-architecture.md`）に「ビューポート変換は Konva 側で適用する」という運用条件が加わる。新しいキャンバス部品を追加するときは `offset` を購読しない。
- ADR-0003 の「Reconsider When」にある「実機計測で目標規模の操作応答性を満たせない」は、この規約を守った実装で判断する。

## Alternatives Considered

- `perfectDrawEnabled` を維持し、Konva ノードのキャッシュ（`cache()`）や図形数の間引きで補う: キャッシュはズームごとに再生成が必要で、間引きは spec §5 の見た目を変える。
- 塗り色と境界線色に alpha を焼き込み、ノードの opacity を 1 にする: 描画結果は `perfectDrawEnabled=false` と同じで、スタイルモデルの変更が増えるだけだった。
- PixiJS への移行: ADR-0003 のゲート（不要なレイヤー再描画の削減とドラッグ中の React 更新抑制）が未着手だったため対象外。

## Reconsider When

- 境界線と塗りの重なりが視認できるほど太い境界線や不透明度がスタイルに加わる。
- Konva が bufferCanvas を使わずに fill と stroke を合成できる描画モードを提供する。
