/**
 * CursorOverlay コンポーネント
 *
 * ツールモードに応じたカーソルオーバーレイを表示する。
 * 各モードで異なるスタイルでカーソル位置を視覚化する。
 */

import { memo } from 'react';
import { Group, Rect, Circle } from 'react-konva';
import type { ToolMode } from '@/types';

/**
 * CursorOverlay の Props
 */
interface CursorOverlayProps {
  /** カーソル位置（グリッド座標）。null の場合は非表示 */
  position: { x: number; y: number } | null;
  /** 現在のツールモード */
  toolMode: ToolMode;
  /** グリッドセルサイズ（ピクセル） */
  gridSize: number;
}

/**
 * カーソルスタイル定数
 */
const CURSOR_STYLES = {
  /** 描画モード：青色のセルハイライト */
  draw: {
    stroke: '#3b82f6',
    strokeWidth: 2,
    fill: 'rgba(59, 130, 246, 0.1)',
  },
  /** 消しゴムモード：赤色のセルハイライト */
  eraser: {
    stroke: '#ef4444',
    strokeWidth: 2,
    fill: 'rgba(239, 68, 68, 0.1)',
  },
  /** 選択モード：グレーの枠線 */
  select: {
    stroke: '#6b7280',
    strokeWidth: 1,
    fill: 'transparent',
  },
  /** ポリゴンモード：青色の円マーカー */
  polygon: {
    stroke: '#3b82f6',
    strokeWidth: 2,
    fill: 'rgba(59, 130, 246, 0.2)',
  },
  /** 線モード：青色の円マーカー */
  line: {
    stroke: '#3b82f6',
    strokeWidth: 2,
    fill: 'rgba(59, 130, 246, 0.2)',
  },
  /** 減算モード：赤色の破線セル */
  subtract: {
    stroke: '#ef4444',
    strokeWidth: 2,
    fill: 'rgba(239, 68, 68, 0.1)',
    dash: [5, 5] as number[],
  },
} as const;

/**
 * カーソルオーバーレイコンポーネント
 *
 * ツールモードに応じたスタイルでカーソル位置を表示する。
 * グリッドにスナップした位置に表示される。
 *
 * @example
 * ```tsx
 * <CursorOverlay
 *   position={{ x: 5, y: 10 }}
 *   toolMode="draw"
 *   gridSize={20}
 * />
 * ```
 */
export const CursorOverlay = memo(
  ({ position, toolMode, gridSize }: CursorOverlayProps) => {
    // カーソル位置がない場合は何も表示しない
    if (!position) return null;

    const x = position.x * gridSize;
    const y = position.y * gridSize;

    return (
      <Group listening={false}>
        {/* 描画モード */}
        {toolMode === 'draw' && (
          <Rect
            x={x}
            y={y}
            width={gridSize}
            height={gridSize}
            stroke={CURSOR_STYLES.draw.stroke}
            strokeWidth={CURSOR_STYLES.draw.strokeWidth}
            fill={CURSOR_STYLES.draw.fill}
          />
        )}

        {/* 消しゴムモード */}
        {toolMode === 'eraser' && (
          <Rect
            x={x}
            y={y}
            width={gridSize}
            height={gridSize}
            stroke={CURSOR_STYLES.eraser.stroke}
            strokeWidth={CURSOR_STYLES.eraser.strokeWidth}
            fill={CURSOR_STYLES.eraser.fill}
          />
        )}

        {/* 選択モード */}
        {toolMode === 'select' && (
          <Rect
            x={x}
            y={y}
            width={gridSize}
            height={gridSize}
            stroke={CURSOR_STYLES.select.stroke}
            strokeWidth={CURSOR_STYLES.select.strokeWidth}
            fill={CURSOR_STYLES.select.fill}
          />
        )}

        {/* ポリゴンモード：円マーカー */}
        {toolMode === 'polygon' && (
          <Circle
            x={x + gridSize / 2}
            y={y + gridSize / 2}
            radius={gridSize / 4}
            stroke={CURSOR_STYLES.polygon.stroke}
            strokeWidth={CURSOR_STYLES.polygon.strokeWidth}
            fill={CURSOR_STYLES.polygon.fill}
          />
        )}

        {/* 線モード：円マーカー */}
        {toolMode === 'line' && (
          <Circle
            x={x + gridSize / 2}
            y={y + gridSize / 2}
            radius={gridSize / 4}
            stroke={CURSOR_STYLES.line.stroke}
            strokeWidth={CURSOR_STYLES.line.strokeWidth}
            fill={CURSOR_STYLES.line.fill}
          />
        )}

        {/* 減算モード：破線セル */}
        {toolMode === 'subtract' && (
          <Rect
            x={x}
            y={y}
            width={gridSize}
            height={gridSize}
            stroke={CURSOR_STYLES.subtract.stroke}
            strokeWidth={CURSOR_STYLES.subtract.strokeWidth}
            dash={CURSOR_STYLES.subtract.dash}
            fill={CURSOR_STYLES.subtract.fill}
          />
        )}
      </Group>
    );
  }
);

CursorOverlay.displayName = 'CursorOverlay';
