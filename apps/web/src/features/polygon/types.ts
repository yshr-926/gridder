/**
 * ポリゴン機能の型定義
 *
 * 頂点描画モードで使用する型を定義します。
 */

import type { CellCoordinate } from '@/types';

/**
 * 頂点座標
 *
 * グリッド座標系での頂点位置を表します。
 */
export interface Vertex {
  /** X座標（グリッド単位） */
  x: number;
  /** Y座標（グリッド単位） */
  y: number;
}

/**
 * 多角形塗りつぶし結果
 *
 * fillPolygon / getPolygonOutline の戻り値として使用します。
 * セルはローカル座標（minX/minY を原点）で格納されます。
 */
export interface FillPolygonResult {
  /** ローカル座標のセル配列（minX/minY を原点とした相対座標） */
  cells: CellCoordinate[];
  /** グリッド上の最小座標（GridObject.position に使用） */
  position: { x: number; y: number };
}
