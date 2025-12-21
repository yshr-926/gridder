/**
 * RECT コマンド
 *
 * 2つの角座標を指定して矩形を作成するコマンドです。
 * 塗りつぶし矩形または輪郭のみの矩形を作成できます。
 */

import type { CommandDefinition, CommandResult } from '../types';
import { parseCoordinate } from '../parser';
import { generateId } from '@/utils/id';
import type { CellCoordinate } from '@/types';

/**
 * 矩形のセルを生成する
 *
 * 2つの角座標から矩形を構成するセル座標を生成します。
 * 座標は自動的に正規化され、左上を原点とした相対座標として返されます。
 *
 * @param x1 - 1つ目の角のX座標
 * @param y1 - 1つ目の角のY座標
 * @param x2 - 2つ目の角のX座標
 * @param y2 - 2つ目の角のY座標
 * @param filled - 塗りつぶすかどうか（デフォルト: true）
 * @returns 矩形を構成するセル座標の配列
 *
 * @example
 * ```typescript
 * // 3x3 の塗りつぶし矩形
 * const cells = createRectCells(0, 0, 2, 2, true);
 * // [[0,0], [0,1], [0,2], [1,0], [1,1], [1,2], [2,0], [2,1], [2,2]]
 *
 * // 3x3 の輪郭のみ
 * const outline = createRectCells(0, 0, 2, 2, false);
 * // 周囲のセルのみ
 * ```
 */
export const createRectCells = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  filled: boolean = true
): CellCoordinate[] => {
  const cells: CellCoordinate[] = [];
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (filled || x === minX || x === maxX || y === minY || y === maxY) {
        cells.push([x - minX, y - minY]);
      }
    }
  }

  return cells;
};

/**
 * RECT コマンド定義
 *
 * 2つの角座標を指定して矩形を作成します。
 * オプションで `outline` を指定すると輪郭のみの矩形を作成できます。
 */
export const rectCommand: CommandDefinition = {
  name: 'RECT',
  aliases: ['R', 'RECTANGLE'],
  description: '矩形を作成',
  syntax: 'RECT x1,y1 x2,y2 [filled|outline]',
  requiredArgs: 2,
  optionalArgs: 1,

  execute: (args, context): CommandResult => {
    const corner1 = parseCoordinate(args[0]);
    const corner2 = parseCoordinate(args[1]);
    const fillOption = args[2];
    const filled = fillOption !== 'outline';

    if (!corner1 || !corner2) {
      return { success: false, message: '無効な座標形式です' };
    }

    const cells = createRectCells(
      Math.round(corner1.x),
      Math.round(corner1.y),
      Math.round(corner2.x),
      Math.round(corner2.y),
      filled
    );

    const { addObject } = context.canvasStore.getState();

    const newObject = {
      id: generateId('obj'),
      cells,
      position: {
        x: Math.min(corner1.x, corner2.x),
        y: Math.min(corner1.y, corner2.y),
      },
      rotation: 0 as const,
      color: context.getNextObjectColor(),
    };

    addObject(newObject);

    const width = Math.abs(corner2.x - corner1.x) + 1;
    const height = Math.abs(corner2.y - corner1.y) + 1;
    const fillType = filled ? '塗りつぶし' : '輪郭';

    return {
      success: true,
      message: `矩形を作成しました (${width}x${height}, ${fillType})`,
      createdObjectId: newObject.id,
    };
  },
};
