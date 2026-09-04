import type { CellCoordinate } from '@/types';

/**
 * エッジを表す型
 * 2点 (x1, y1) から (x2, y2) への線分
 */
interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * セル配列から外周のエッジを収集する
 * 隣接するセルがない方向のエッジを外周として抽出
 *
 * @param cells - セル座標の配列
 * @returns 外周エッジの配列
 */
export const collectOuterEdges = (cells: CellCoordinate[]): Edge[] => {
  if (cells.length === 0) return [];

  // セルをSetに変換（高速検索用）
  const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));

  const edges: Edge[] = [];

  for (const [x, y] of cells) {
    // 上端: 上隣がなければエッジ
    if (!cellSet.has(`${x},${y - 1}`)) {
      edges.push({ x1: x, y1: y, x2: x + 1, y2: y });
    }
    // 下端: 下隣がなければエッジ
    if (!cellSet.has(`${x},${y + 1}`)) {
      edges.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1 });
    }
    // 左端: 左隣がなければエッジ
    if (!cellSet.has(`${x - 1},${y}`)) {
      edges.push({ x1: x, y1: y, x2: x, y2: y + 1 });
    }
    // 右端: 右隣がなければエッジ
    if (!cellSet.has(`${x + 1},${y}`)) {
      edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
    }
  }

  return edges;
};

/**
 * エッジを連結してパスを構築
 * エッジの終点と次のエッジの始点を一致させて連結順にソート
 *
 * @param edges - エッジの配列
 * @returns 連結順にソートされたエッジの配列
 */
export const sortEdgesToPath = (edges: Edge[]): Edge[] => {
  if (edges.length === 0) return [];

  const result: Edge[] = [];
  const remaining = [...edges];

  // 最初のエッジから開始
  result.push(remaining.shift()!);

  while (remaining.length > 0) {
    const lastEdge = result[result.length - 1];
    const lastPoint = { x: lastEdge.x2, y: lastEdge.y2 };

    // 接続するエッジを検索
    const nextIndex = remaining.findIndex(
      (e) =>
        (e.x1 === lastPoint.x && e.y1 === lastPoint.y) ||
        (e.x2 === lastPoint.x && e.y2 === lastPoint.y)
    );

    if (nextIndex === -1) break;

    const nextEdge = remaining.splice(nextIndex, 1)[0];

    // 向きを揃える（終点が最後の終点と一致する場合は反転）
    if (nextEdge.x2 === lastPoint.x && nextEdge.y2 === lastPoint.y) {
      // 反転
      [nextEdge.x1, nextEdge.y1, nextEdge.x2, nextEdge.y2] = [
        nextEdge.x2,
        nextEdge.y2,
        nextEdge.x1,
        nextEdge.y1,
      ];
    }

    result.push(nextEdge);
  }

  return result;
};

/**
 * 連続するエッジを統合して頂点数を削減
 * 同じ方向（水平または垂直）に連続するエッジを1つにまとめる
 *
 * @param edges - 連結順にソートされたエッジの配列
 * @returns 統合されたエッジの配列
 */
export const mergeContiguousEdges = (edges: Edge[]): Edge[] => {
  if (edges.length <= 1) return edges;

  const merged: Edge[] = [];
  let current = { ...edges[0] };

  for (let i = 1; i < edges.length; i++) {
    const next = edges[i];

    // 方向を判定
    const currentIsHorizontal = current.y1 === current.y2;
    const nextIsHorizontal = next.y1 === next.y2;
    const currentIsVertical = current.x1 === current.x2;
    const nextIsVertical = next.x1 === next.x2;

    // 同じ方向かつ同じ軸上にあれば統合
    if (
      (currentIsHorizontal &&
        nextIsHorizontal &&
        current.y1 === next.y1 &&
        current.x2 === next.x1) ||
      (currentIsVertical &&
        nextIsVertical &&
        current.x1 === next.x1 &&
        current.y2 === next.y1)
    ) {
      // 現在のエッジの終点を次のエッジの終点に更新
      current.x2 = next.x2;
      current.y2 = next.y2;
    } else {
      // 方向が変わったら現在のエッジを確定
      merged.push(current);
      current = { ...next };
    }
  }

  // 最後のエッジを追加
  merged.push(current);

  return merged;
};

/**
 * セル配列から外周の輪郭ポイントを抽出
 * Konva.Line 用のポイント配列を返す
 *
 * @param cells - セル座標の配列
 * @param gridSize - グリッドサイズ（ピクセル）
 * @returns Konva.Line 用のポイント配列 [x1, y1, x2, y2, ...]
 */
export const getObjectOutline = (
  cells: CellCoordinate[],
  gridSize: number
): number[] => {
  if (cells.length === 0) return [];

  // 1. エッジを収集
  const edges = collectOuterEdges(cells);
  if (edges.length === 0) return [];

  // 2. エッジを連結順にソート
  const sortedEdges = sortEdgesToPath(edges);
  if (sortedEdges.length === 0) return [];

  // 3. 連続するエッジを統合
  const mergedEdges = mergeContiguousEdges(sortedEdges);

  // 4. ポイント配列を構築
  const points: number[] = [];
  if (mergedEdges.length > 0) {
    // 最初のエッジの始点
    points.push(mergedEdges[0].x1 * gridSize, mergedEdges[0].y1 * gridSize);

    // 各エッジの終点を追加
    for (const edge of mergedEdges) {
      points.push(edge.x2 * gridSize, edge.y2 * gridSize);
    }
  }

  return points;
};
