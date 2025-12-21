/**
 * LINE コマンド
 *
 * 2点間に線を引くコマンドです。
 * ブレゼンハムのアルゴリズムを使用して効率的に線を描画します。
 */

import type { CommandDefinition, CommandResult } from '../types';
import { parseCoordinate, parseRelativeCoordinate } from '../parser';
import { generateId } from '@/utils/id';
import { normalizeCells } from '@/utils/cellUtils';
import type { CellCoordinate } from '@/types';

/**
 * 2点間の線を描画する（ブレゼンハムのアルゴリズム）
 *
 * 効率的なラスタライズアルゴリズムを使用して、
 * 2つの座標間の直線を構成するセル座標を計算します。
 *
 * @param x0 - 始点のX座標
 * @param y0 - 始点のY座標
 * @param x1 - 終点のX座標
 * @param y1 - 終点のY座標
 * @returns 線を構成するセル座標の配列
 *
 * @example
 * ```typescript
 * const cells = drawLine(0, 0, 5, 5);
 * // 対角線上のセル座標が返される
 * ```
 */
export const drawLine = (
  x0: number,
  y0: number,
  x1: number,
  y1: number
): CellCoordinate[] => {
  const cells: CellCoordinate[] = [];

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    cells.push([x, y]);

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return cells;
};

/**
 * LINE コマンド定義
 *
 * 2点間に線を引くコマンドです。
 * 引数なしで実行すると対話モードに入り、始点・終点を順に入力できます。
 * 相対座標（@x,y 形式）も使用できます。
 */
export const lineCommand: CommandDefinition = {
  name: 'LINE',
  aliases: ['L'],
  description: '2点間に線を引く',
  syntax: 'LINE x1,y1 x2,y2 または LINE（対話モード）',
  requiredArgs: 0,
  optionalArgs: 2,

  execute: (args, context): CommandResult => {
    // 対話モード（引数なし）
    if (args.length === 0) {
      return {
        success: true,
        prompt: '始点を指定してください (x,y):',
        stateUpdate: { lastPoint: null },
      };
    }

    // 始点のみ指定
    if (args.length === 1) {
      const point =
        parseCoordinate(args[0]) ||
        (context.lastPoint && parseRelativeCoordinate(args[0], context.lastPoint));

      if (!point) {
        return { success: false, message: '無効な座標形式です' };
      }

      return {
        success: true,
        prompt: '終点を指定してください (x,y):',
        stateUpdate: { lastPoint: point },
      };
    }

    // 始点と終点が指定された場合
    const start =
      parseCoordinate(args[0]) ||
      (context.lastPoint && parseRelativeCoordinate(args[0], context.lastPoint));
    const end =
      parseCoordinate(args[1]) ||
      (start && parseRelativeCoordinate(args[1], start));

    if (!start || !end) {
      return { success: false, message: '無効な座標形式です' };
    }

    // 線を描画
    const cells = drawLine(
      Math.round(start.x),
      Math.round(start.y),
      Math.round(end.x),
      Math.round(end.y)
    );

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
      message: `線を作成しました (${cells.length} セル)`,
      createdObjectId: newObject.id,
      stateUpdate: { lastPoint: end },
    };
  },
};
