/**
 * FILL コマンド
 *
 * 指定位置から塗りつぶしを行うコマンドです。
 * Flood Fillアルゴリズムを使用して、空き領域を塗りつぶします。
 */

import type { CommandDefinition, CommandResult } from '../types';
import { parseCoordinate } from '../parser';
import { generateId } from '@/utils/id';
import { normalizeCells } from '@/utils/cellUtils';
import type { CellCoordinate } from '@/types';

/**
 * 塗りつぶしアルゴリズム（Flood Fill）
 *
 * 指定された開始位置から、占有されていない領域を塗りつぶします。
 * BFS（幅優先探索）を使用して、4方向に展開します。
 *
 * @param startX - 開始位置のX座標
 * @param startY - 開始位置のY座標
 * @param occupied - 既に占有されているセルのキーを含むSet（"x,y" 形式）
 * @param maxDistance - 開始位置からの最大距離（デフォルト: 100）
 * @returns 塗りつぶされたセル座標の配列
 *
 * @example
 * ```typescript
 * const occupied = new Set(['5,5', '6,5', '7,5']);
 * const cells = floodFill(10, 10, occupied, 50);
 * // 開始位置から50グリッド以内の空き領域が塗りつぶされる
 * ```
 */
export const floodFill = (
  startX: number,
  startY: number,
  occupied: Set<string>,
  maxDistance: number = 100
): CellCoordinate[] => {
  const cells: CellCoordinate[] = [];
  const visited = new Set<string>();
  const queue: [number, number][] = [[startX, startY]];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const [x, y] = current;
    const key = `${x},${y}`;

    if (visited.has(key) || occupied.has(key)) continue;
    if (Math.abs(x - startX) > maxDistance || Math.abs(y - startY) > maxDistance) continue;

    visited.add(key);
    cells.push([x, y]);

    // 4方向に展開
    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }

  return cells;
};

/**
 * FILL コマンド定義
 *
 * 指定位置から塗りつぶしを行います。
 * 既存オブジェクトに囲まれた領域を塗りつぶすのに便利です。
 */
export const fillCommand: CommandDefinition = {
  name: 'FILL',
  aliases: ['F'],
  description: '指定位置から塗りつぶし',
  syntax: 'FILL x,y',
  requiredArgs: 1,
  optionalArgs: 0,

  execute: (args, context): CommandResult => {
    const point = parseCoordinate(args[0]);

    if (!point) {
      return { success: false, message: '無効な座標形式です' };
    }

    const { objects } = context.canvasStore.getState();

    // 既に占有されているセルを収集
    const occupied = new Set<string>();
    for (const obj of objects) {
      for (const [cellX, cellY] of obj.cells) {
        const globalX = obj.position.x + cellX;
        const globalY = obj.position.y + cellY;
        occupied.add(`${globalX},${globalY}`);
      }
    }

    // 開始位置が既に占有されている場合
    const startKey = `${Math.round(point.x)},${Math.round(point.y)}`;
    if (occupied.has(startKey)) {
      return { success: false, message: 'この位置は既に占有されています' };
    }

    // 塗りつぶし
    const cells = floodFill(Math.round(point.x), Math.round(point.y), occupied);

    if (cells.length === 0) {
      return { success: false, message: '塗りつぶす領域がありません' };
    }

    // セル数が多すぎる場合は警告
    if (cells.length > 1000) {
      return {
        success: false,
        message: `塗りつぶし範囲が大きすぎます (${cells.length} セル)。最大100グリッド距離まで対応しています。`,
      };
    }

    // オブジェクトを作成
    const { normalizedCells, position } = normalizeCells(cells);
    const { addObject } = context.canvasStore.getState();

    const newObject = {
      id: generateId('obj'),
      cells: normalizedCells,
      position,
      rotation: 0 as const,
      color: context.getNextObjectColor(),
    };

    addObject(newObject);

    return {
      success: true,
      message: `領域を塗りつぶしました (${cells.length} セル)`,
      createdObjectId: newObject.id,
    };
  },
};
