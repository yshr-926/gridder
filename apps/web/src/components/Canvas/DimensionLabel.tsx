import { memo, useMemo } from 'react';
import { Text, Line, Group } from 'react-konva';
import type { GridObject, DimensionSettings, Unit } from '@/types';
import { DEFAULT_DIMENSION_SETTINGS } from '@/types';
import {
  calculateBoundingBox,
  calculateOuterEdges,
  formatSizeLabel,
  type EdgeInfo,
} from '@/utils/dimension';

/**
 * DimensionLabel Props
 */
interface DimensionLabelProps {
  /** グリッドオブジェクト */
  object: GridObject;
  /** グリッドサイズ（ピクセル） */
  gridSize: number;
  /** セルサイズ（実寸） */
  cellSize: number;
  /** 単位 */
  unit: Unit;
  /** グローバル設定（UIストアから渡される） */
  settings: DimensionSettings;
}

/**
 * EdgeDimensionLabels Props
 */
interface EdgeDimensionLabelsProps {
  /** 辺の情報配列 */
  edges: EdgeInfo[];
  /** グリッドサイズ（ピクセル） */
  gridSize: number;
  /** フォントサイズ */
  fontSize: number;
  /** テキスト色 */
  textColor: string;
}

/**
 * 各辺の寸法を表示するサブコンポーネント
 */
const EdgeDimensionLabels = memo(
  ({ edges, gridSize, fontSize, textColor }: EdgeDimensionLabelsProps) => {
    return (
      <>
        {edges.map((edge, index) => {
          // 辺の中心位置を計算
          const centerX = ((edge.start.x + edge.end.x) / 2) * gridSize;
          const centerY = ((edge.start.y + edge.end.y) / 2) * gridSize;

          // ラベルのオフセット（辺の外側に表示）
          const offset = fontSize + 4;
          const labelX = edge.direction === 'horizontal' ? centerX : centerX + offset;
          const labelY = edge.direction === 'horizontal' ? centerY - offset : centerY;

          const label = `${edge.lengthReal}`;

          return (
            <Text
              key={`edge-${index}`}
              x={labelX}
              y={labelY}
              text={label}
              fontSize={fontSize}
              fill={textColor}
              align="center"
              verticalAlign="middle"
              offsetX={label.length * fontSize * 0.25}
              offsetY={fontSize / 2}
              listening={false}
            />
          );
        })}
      </>
    );
  }
);

EdgeDimensionLabels.displayName = 'EdgeDimensionLabels';

/**
 * オブジェクトの寸法を表示するコンポーネント
 */
export const DimensionLabel = memo(
  ({ object, gridSize, cellSize, unit, settings }: DimensionLabelProps) => {
    const { cells } = object;

    // グローバル設定をデフォルトとマージ
    const dimensionSettings = useMemo(
      () => ({
        ...DEFAULT_DIMENSION_SETTINGS,
        ...settings,
      }),
      [settings]
    );

    const bbox = useMemo(() => calculateBoundingBox(cells), [cells]);

    // 各辺の情報を計算（edges/both モード用）
    const edges = useMemo(() => {
      if (dimensionSettings.displayMode === 'edges' || dimensionSettings.displayMode === 'both') {
        return calculateOuterEdges(cells, cellSize);
      }
      return [];
    }, [cells, cellSize, dimensionSettings.displayMode]);

    // サイズラベル（size/both モード用）
    const sizeLabel = useMemo(() => {
      if (dimensionSettings.displayMode === 'size' || dimensionSettings.displayMode === 'both') {
        const widthReal = bbox.width * cellSize;
        const heightReal = bbox.height * cellSize;
        return formatSizeLabel(widthReal, heightReal, unit);
      }
      return '';
    }, [bbox, cellSize, unit, dimensionSettings.displayMode]);

    // サイズラベルの表示位置（オブジェクトの下部）
    const labelPosition = useMemo(
      () => ({
        x: (bbox.minX + bbox.width / 2) * gridSize,
        y: (bbox.maxY + 1) * gridSize + 16,
      }),
      [bbox, gridSize]
    );

    // 寸法線の位置
    const dimensionLines = useMemo(() => {
      if (!dimensionSettings.showDimensionLines) return null;

      const offset = 8;

      return {
        // 幅の寸法線（上部）
        width: {
          y: bbox.minY * gridSize - offset,
          startX: bbox.minX * gridSize,
          endX: (bbox.maxX + 1) * gridSize,
        },
        // 高さの寸法線（右部）
        height: {
          x: (bbox.maxX + 1) * gridSize + offset,
          startY: bbox.minY * gridSize,
          endY: (bbox.maxY + 1) * gridSize,
        },
      };
    }, [bbox, gridSize, dimensionSettings.showDimensionLines]);

    // 推定テキスト幅
    const estimatedLabelWidth = useMemo(() => {
      return sizeLabel.length * dimensionSettings.fontSize * 0.25;
    }, [sizeLabel, dimensionSettings.fontSize]);

    // displayMode が 'none' の場合は何も表示しない
    if (dimensionSettings.displayMode === 'none') return null;

    return (
      <Group listening={false}>
        {/* サイズラベル（幅 x 高さ形式） */}
        {sizeLabel && (
          <Text
            x={labelPosition.x}
            y={labelPosition.y}
            text={sizeLabel}
            fontSize={dimensionSettings.fontSize}
            fill={dimensionSettings.textColor}
            align="center"
            offsetX={estimatedLabelWidth}
          />
        )}

        {/* 各辺の寸法ラベル */}
        {edges.length > 0 && (
          <EdgeDimensionLabels
            edges={edges}
            gridSize={gridSize}
            fontSize={dimensionSettings.fontSize}
            textColor={dimensionSettings.textColor}
          />
        )}

        {/* 寸法線 */}
        {dimensionLines && (
          <>
            {/* 幅の寸法線 */}
            <Line
              points={[
                dimensionLines.width.startX,
                dimensionLines.width.y,
                dimensionLines.width.endX,
                dimensionLines.width.y,
              ]}
              stroke={dimensionSettings.textColor}
              strokeWidth={1}
              listening={false}
            />
            {/* 高さの寸法線 */}
            <Line
              points={[
                dimensionLines.height.x,
                dimensionLines.height.startY,
                dimensionLines.height.x,
                dimensionLines.height.endY,
              ]}
              stroke={dimensionSettings.textColor}
              strokeWidth={1}
              listening={false}
            />
          </>
        )}
      </Group>
    );
  }
);

DimensionLabel.displayName = 'DimensionLabel';

// Export EdgeDimensionLabels for testing
export { EdgeDimensionLabels };
