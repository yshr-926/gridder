/**
 * 画面・ワールド・グリッドピクセル座標系で共有する 2D 座標。
 *
 * editor-core の `GridPoint`（ドキュメント内のグリッド座標、readonly）とは
 * 意味的に別物: こちらはビューポート変換（features/viewport,
 * stores/viewportStore, features/editor/useEditorInteraction 等）が扱う
 * 画面/ワールド空間の可変な座標を表す。
 */
export interface Position {
  x: number;
  y: number;
}
