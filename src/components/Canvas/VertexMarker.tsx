/**
 * VertexMarker コンポーネント
 *
 * ポリゴン描画モードで頂点を表示するマーカー。
 * 最初の頂点にはクリック可能を示す青いリングを表示する。
 */

import { memo } from 'react';
import { Circle, Group, Text } from 'react-konva';

/**
 * VertexMarker Props
 */
interface VertexMarkerProps {
  /** X座標（グリッド単位） */
  x: number;
  /** Y座標（グリッド単位） */
  y: number;
  /** グリッドセルサイズ（ピクセル） */
  gridSize: number;
  /** 頂点のインデックス（0始まり） */
  index: number;
  /** 最初の頂点かどうか（クリック可能を示す） */
  isFirst?: boolean;
  /** クリックハンドラ */
  onClick?: () => void;
}

/**
 * 頂点マーカーのスタイル定数
 */
const MARKER_STYLE = {
  /** 頂点の半径 */
  radius: 4,
  /** 外側リングの半径（最初の頂点用） */
  ringRadius: 8,
  /** 外側リングの太さ */
  ringStrokeWidth: 2,
  /** 最初の頂点の色（青） */
  firstVertexColor: '#3b82f6',
  /** 通常頂点の色（ダークグレー） */
  normalVertexColor: '#1f2937',
  /** 頂点の縁取り色 */
  strokeColor: '#ffffff',
  /** 頂点の縁取り太さ */
  strokeWidth: 1,
  /** 番号テキストのフォントサイズ */
  fontSize: 10,
  /** 番号テキストのオフセット */
  textOffset: { x: 8, y: -6 },
} as const;

/**
 * 頂点マーカーコンポーネント
 *
 * ポリゴン描画モードで配置された頂点を表示する。
 * - 通常の頂点: 黒い点と番号
 * - 最初の頂点（3頂点以上）: 青い点と外側リング（クリック可能を示す）
 */
export const VertexMarker = memo(
  ({ x, y, gridSize, index, isFirst = false, onClick }: VertexMarkerProps) => {
    // グリッド座標からピクセル座標に変換
    const pixelX = x * gridSize;
    const pixelY = y * gridSize;

    return (
      <Group
        x={pixelX}
        y={pixelY}
        onClick={onClick}
        onTap={onClick}
        listening={Boolean(onClick)}
      >
        {/* 外側のリング（最初の頂点で3頂点以上の場合に表示） */}
        {isFirst && (
          <Circle
            radius={MARKER_STYLE.ringRadius}
            stroke={MARKER_STYLE.firstVertexColor}
            strokeWidth={MARKER_STYLE.ringStrokeWidth}
            fill="transparent"
          />
        )}

        {/* 頂点の点 */}
        <Circle
          radius={MARKER_STYLE.radius}
          fill={isFirst ? MARKER_STYLE.firstVertexColor : MARKER_STYLE.normalVertexColor}
          stroke={MARKER_STYLE.strokeColor}
          strokeWidth={MARKER_STYLE.strokeWidth}
        />

        {/* 頂点番号 */}
        <Text
          x={MARKER_STYLE.textOffset.x}
          y={MARKER_STYLE.textOffset.y}
          text={String(index + 1)}
          fontSize={MARKER_STYLE.fontSize}
          fill={MARKER_STYLE.normalVertexColor}
        />
      </Group>
    );
  }
);

VertexMarker.displayName = 'VertexMarker';
