import { memo, useMemo, type ReactNode } from 'react';
import { Rect, Line, Group } from 'react-konva';

/**
 * GridBackground Props
 */
interface GridBackgroundProps {
  /** 描画する最初の垂直グリッド線のインデックス（セル単位、包含） */
  startX: number;
  /** 描画する最初の水平グリッド線のインデックス（セル単位、包含） */
  startY: number;
  /** 描画する最後の垂直グリッド線のインデックス（セル単位、包含） */
  endX: number;
  /** 描画する最後の水平グリッド線のインデックス（セル単位、包含） */
  endY: number;
  /** 1グリッドのピクセルサイズ */
  gridSize: number;
  /** ズーム倍率（線の太さを画面上で一定に保つために使う） */
  zoom: number;
  /**
   * 白い背景矩形を描くか。既定は true。透明背景の共有画像（#67）では
   * グリッド線だけを描くため false にする。
   */
  isBackgroundVisible?: boolean;
}

/**
 * グリッド線の色
 */
const GRID_COLOR = '#e5e7eb'; // Tailwind gray-200
const MAJOR_GRID_COLOR = '#d1d5db'; // Tailwind gray-300
const BACKGROUND_COLOR = '#ffffff';

/**
 * グリッド線の太さ（画面ピクセル、zoom=1 のとき）。通常線は 0.5px、5マスごとの
 * 太線は 1px。通常線の値は共有画像（#67）が最小 1 デバイスピクセルを保証する
 * ための補正に使うので公開する。
 */
export const GRID_NORMAL_STROKE_WIDTH = 0.5;
const NORMAL_STROKE_WIDTH = GRID_NORMAL_STROKE_WIDTH;
const MAJOR_STROKE_WIDTH = 1;

/**
 * GridBackground コンポーネント
 * グリッド（方眼）を描画する。
 *
 * 描画範囲はセル単位のインデックス範囲で受け取る（#61）。呼び出し側が
 * `visibleCellRange` で可視範囲を量子化してから渡せば、サブピクセルのパンでは
 * props が変わらず、`memo` と `useMemo` がそのまま効く。パン位置そのものは
 * Stage の変換で表現されるので、ここでは扱わない。
 */
export const GridBackground = memo(
  ({
    startX,
    startY,
    endX,
    endY,
    gridSize,
    zoom,
    isBackgroundVisible = true,
  }: GridBackgroundProps) => {
    /**
     * 表示領域の計算とグリッド線の生成
     */
    const { background, lines } = useMemo(() => {
      const left = startX * gridSize;
      const top = startY * gridSize;
      const right = endX * gridSize;
      const bottom = endY * gridSize;

      // グリッド線を生成
      const gridLines: ReactNode[] = [];
      let lineKey = 0;

      // 垂直線
      for (let x = startX; x <= endX; x++) {
        const isMajor = x % 5 === 0;
        const xPos = x * gridSize;
        gridLines.push(
          <Line
            key={`v-${lineKey++}`}
            points={[xPos, top, xPos, bottom]}
            stroke={isMajor ? MAJOR_GRID_COLOR : GRID_COLOR}
            strokeWidth={(isMajor ? MAJOR_STROKE_WIDTH : NORMAL_STROKE_WIDTH) / zoom}
            listening={false}
          />
        );
      }

      // 水平線
      for (let y = startY; y <= endY; y++) {
        const isMajor = y % 5 === 0;
        const yPos = y * gridSize;
        gridLines.push(
          <Line
            key={`h-${lineKey++}`}
            points={[left, yPos, right, yPos]}
            stroke={isMajor ? MAJOR_GRID_COLOR : GRID_COLOR}
            strokeWidth={(isMajor ? MAJOR_STROKE_WIDTH : NORMAL_STROKE_WIDTH) / zoom}
            listening={false}
          />
        );
      }

      return {
        background: isBackgroundVisible ? (
          <Rect
            x={left}
            y={top}
            width={right - left}
            height={bottom - top}
            fill={BACKGROUND_COLOR}
            listening={false}
          />
        ) : null,
        lines: gridLines,
      };
    }, [startX, startY, endX, endY, gridSize, zoom, isBackgroundVisible]);

    return (
      <Group listening={false}>
        {background}
        {lines}
      </Group>
    );
  }
);

GridBackground.displayName = 'GridBackground';
