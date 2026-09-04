/**
 * 多角形塗りつぶしアルゴリズム
 *
 * セル中心ベースのレイキャスティング法を使用して多角形を塗りつぶし、
 * ブレゼンハムのアルゴリズムで輪郭線を取得します。
 */

import type { CellCoordinate } from '@/types';
import type { FillPolygonResult, Vertex } from './types';
import { drawLine } from '@/features/commands/commands/line';

/**
 * 点がポリゴン内にあるかを判定（レイキャスティング法）
 *
 * 点から右方向に半直線を引き、ポリゴンの辺との交点数をカウントします。
 * 交点数が奇数なら内側、偶数なら外側と判定します。
 *
 * @param x - X座標
 * @param y - Y座標
 * @param vertices - 多角形の頂点配列
 * @returns 点がポリゴン内にあればtrue
 */
const isPointInPolygon = (x: number, y: number, vertices: Vertex[]): boolean => {
  let inside = false;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    // 辺がy座標をまたぐかチェックし、交点のx座標が点の右側にあるか判定
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

/**
 * 多角形の頂点配列からセルを塗りつぶす（セル中心ベース判定）
 *
 * 各セルの中心座標がポリゴン内にあるかをレイキャスティング法で判定し、
 * 内側にあるセルのみを塗りつぶします。これにより、頂点座標がセルの
 * 左上を指す場合でも、正確な境界で塗りつぶしが行われます。
 *
 * @param vertices - 多角形の頂点配列（最低3つ必要）
 * @returns 塗りつぶし結果（ローカル座標のセル配列とposition）
 *
 * @example
 * ```typescript
 * const result = fillPolygon([
 *   { x: 0, y: 0 },
 *   { x: 3, y: 0 },
 *   { x: 3, y: 3 },
 *   { x: 0, y: 3 },
 * ]);
 * // result.cells には 3x3 = 9 セルが含まれる
 * // result.position は { x: 0, y: 0 }
 * ```
 */
export const fillPolygon = (vertices: Vertex[]): FillPolygonResult => {
  if (vertices.length < 3) {
    return { cells: [], position: { x: 0, y: 0 } };
  }

  const cells: CellCoordinate[] = [];

  // バウンディングボックスを計算
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;

  for (const v of vertices) {
    minY = Math.min(minY, Math.floor(v.y));
    maxY = Math.max(maxY, Math.ceil(v.y));
    minX = Math.min(minX, Math.floor(v.x));
    maxX = Math.max(maxX, Math.ceil(v.x));
  }

  // 空のポリゴンの場合
  if (minX > maxX || minY > maxY) {
    return { cells: [], position: { x: 0, y: 0 } };
  }

  // 各セルの中心がポリゴン内にあるかチェック
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      // セルの中心座標（グリッド座標 + 0.5）
      const centerX = x + 0.5;
      const centerY = y + 0.5;

      if (isPointInPolygon(centerX, centerY, vertices)) {
        cells.push([x - minX, y - minY]);
      }
    }
  }

  return {
    cells,
    position: { x: minX, y: minY },
  };
};

/**
 * 多角形の輪郭線のセルを取得
 *
 * ブレゼンハムのアルゴリズムを使用して各辺を描画し、
 * 輪郭線を構成するセルを返します。
 *
 * @param vertices - 多角形の頂点配列（最低2つ必要）
 * @returns 輪郭線結果（ローカル座標のセル配列とposition）
 *
 * @example
 * ```typescript
 * const result = getPolygonOutline([
 *   { x: 0, y: 0 },
 *   { x: 4, y: 0 },
 *   { x: 2, y: 3 },
 * ]);
 * // result.cells には三角形の輪郭線セル座標が含まれる
 * ```
 */
export const getPolygonOutline = (vertices: Vertex[]): FillPolygonResult => {
  if (vertices.length < 2) {
    return { cells: [], position: { x: 0, y: 0 } };
  }

  const allCells: CellCoordinate[] = [];

  // 各辺をブレゼンハムで描画
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];

    const lineCells = drawLine(
      Math.round(v1.x),
      Math.round(v1.y),
      Math.round(v2.x),
      Math.round(v2.y)
    );

    allCells.push(...lineCells);
  }

  // 重複除去
  const unique = new Map<string, CellCoordinate>();
  for (const cell of allCells) {
    unique.set(`${cell[0]},${cell[1]}`, cell);
  }

  const cells = Array.from(unique.values());

  // 空の場合
  if (cells.length === 0) {
    return { cells: [], position: { x: 0, y: 0 } };
  }

  // minX/minY を計算してローカル座標に変換
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }

  const normalizedCells: CellCoordinate[] = cells.map(([x, y]) => [
    x - minX,
    y - minY,
  ]);

  return {
    cells: normalizedCells,
    position: { x: minX, y: minY },
  };
};
