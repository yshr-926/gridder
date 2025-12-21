/**
 * 多角形塗りつぶしアルゴリズム
 *
 * スキャンラインアルゴリズムを使用して多角形を塗りつぶし、
 * ブレゼンハムのアルゴリズムで輪郭線を取得します。
 */

import type { CellCoordinate } from '@/types';
import type { FillPolygonResult, Vertex } from './types';
import { drawLine } from '@/features/commands/commands/line';

/**
 * 多角形の頂点配列からセルを塗りつぶす（スキャンラインアルゴリズム）
 *
 * スキャンラインアルゴリズムは各行（y座標）ごとに多角形との交点を計算し、
 * 交点間を塗りつぶすことで多角形内部のセルを効率的に取得します。
 *
 * @param vertices - 多角形の頂点配列（最低3つ必要）
 * @returns 塗りつぶし結果（ローカル座標のセル配列とposition）
 *
 * @example
 * ```typescript
 * const result = fillPolygon([
 *   { x: 0, y: 0 },
 *   { x: 4, y: 0 },
 *   { x: 2, y: 3 },
 * ]);
 * // result.cells には三角形内部のセル座標が含まれる
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

  // 各行をスキャン
  for (let y = minY; y <= maxY; y++) {
    const intersections: number[] = [];

    // 各辺との交点を計算
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % vertices.length];

      // 交差判定: 辺が y 座標をまたぐかどうか
      if ((v1.y <= y && v2.y > y) || (v2.y <= y && v1.y > y)) {
        // 線形補間で交点の x 座標を計算
        const x = v1.x + ((y - v1.y) / (v2.y - v1.y)) * (v2.x - v1.x);
        intersections.push(x);
      }
    }

    // 交点をソート
    intersections.sort((a, b) => a - b);

    // ペアごとに塗りつぶし（ローカル座標で格納）
    for (let i = 0; i < intersections.length; i += 2) {
      if (i + 1 < intersections.length) {
        const startX = Math.ceil(intersections[i]);
        const endX = Math.floor(intersections[i + 1]);

        for (let x = startX; x <= endX; x++) {
          cells.push([x - minX, y - minY]);
        }
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
