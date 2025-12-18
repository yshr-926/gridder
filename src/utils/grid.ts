import type { Position } from '@/types';

/**
 * ピクセル座標をグリッド座標にスナップする
 */
export function snapToGrid(pixelPosition: Position, gridPixelSize: number): Position {
  return {
    x: Math.round(pixelPosition.x / gridPixelSize) * gridPixelSize,
    y: Math.round(pixelPosition.y / gridPixelSize) * gridPixelSize,
  };
}

/**
 * ピクセル座標をグリッドセル座標に変換する
 */
export function pixelToCell(pixelPosition: Position, gridPixelSize: number): Position {
  return {
    x: Math.floor(pixelPosition.x / gridPixelSize),
    y: Math.floor(pixelPosition.y / gridPixelSize),
  };
}

/**
 * グリッドセル座標をピクセル座標に変換する
 */
export function cellToPixel(cellPosition: Position, gridPixelSize: number): Position {
  return {
    x: cellPosition.x * gridPixelSize,
    y: cellPosition.y * gridPixelSize,
  };
}
