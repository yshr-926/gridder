import { memo, useMemo, type ReactNode } from 'react';
import { Rect, Line, Group } from 'react-konva';

/**
 * GridBackground Props
 */
interface GridBackgroundProps {
  /** キャンバス幅 */
  width: number;
  /** キャンバス高さ */
  height: number;
  /** 1グリッドのピクセルサイズ */
  gridSize: number;
  /** パン位置X */
  panX: number;
  /** パン位置Y */
  panY: number;
  /** ズーム倍率 */
  zoom: number;
}

/**
 * グリッド線の色
 */
const GRID_COLOR = '#e5e7eb'; // Tailwind gray-200
const MAJOR_GRID_COLOR = '#d1d5db'; // Tailwind gray-300
const BACKGROUND_COLOR = '#ffffff';

/**
 * 5マスごとの太線の太さ
 */
const NORMAL_STROKE_WIDTH = 0.5;
const MAJOR_STROKE_WIDTH = 1;

/**
 * GridBackground コンポーネント
 * グリッド（方眼）を描画する
 */
export const GridBackground = memo(
  ({ width, height, gridSize, panX, panY, zoom }: GridBackgroundProps) => {
    /**
     * 表示領域の計算とグリッド線の生成
     */
    const { background, lines } = useMemo(() => {
      // 表示領域の計算（パン・ズームを考慮）
      const visibleStartX = Math.floor(-panX / zoom / gridSize) - 1;
      const visibleStartY = Math.floor(-panY / zoom / gridSize) - 1;
      const visibleEndX = Math.ceil((width - panX) / zoom / gridSize) + 1;
      const visibleEndY = Math.ceil((height - panY) / zoom / gridSize) + 1;

      // 背景のサイズ（十分に大きく）
      const bgSize = 20000;
      const bgOffset = -10000;

      // グリッド線を生成
      const gridLines: ReactNode[] = [];
      let lineKey = 0;

      // 垂直線
      for (let x = visibleStartX; x <= visibleEndX; x++) {
        const isMajor = x % 5 === 0;
        const xPos = x * gridSize;
        gridLines.push(
          <Line
            key={`v-${lineKey++}`}
            points={[xPos, visibleStartY * gridSize, xPos, visibleEndY * gridSize]}
            stroke={isMajor ? MAJOR_GRID_COLOR : GRID_COLOR}
            strokeWidth={(isMajor ? MAJOR_STROKE_WIDTH : NORMAL_STROKE_WIDTH) / zoom}
            listening={false}
          />
        );
      }

      // 水平線
      for (let y = visibleStartY; y <= visibleEndY; y++) {
        const isMajor = y % 5 === 0;
        const yPos = y * gridSize;
        gridLines.push(
          <Line
            key={`h-${lineKey++}`}
            points={[visibleStartX * gridSize, yPos, visibleEndX * gridSize, yPos]}
            stroke={isMajor ? MAJOR_GRID_COLOR : GRID_COLOR}
            strokeWidth={(isMajor ? MAJOR_STROKE_WIDTH : NORMAL_STROKE_WIDTH) / zoom}
            listening={false}
          />
        );
      }

      return {
        background: (
          <Rect
            x={bgOffset}
            y={bgOffset}
            width={bgSize}
            height={bgSize}
            fill={BACKGROUND_COLOR}
            listening={false}
          />
        ),
        lines: gridLines,
      };
    }, [width, height, gridSize, panX, panY, zoom]);

    return (
      <Group listening={false}>
        {background}
        {lines}
      </Group>
    );
  }
);

GridBackground.displayName = 'GridBackground';
