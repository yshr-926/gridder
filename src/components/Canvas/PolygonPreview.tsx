/**
 * PolygonPreview コンポーネント
 *
 * ポリゴン描画モードで描画中のポリゴンをプレビュー表示する。
 * - 配置済み頂点間の線
 * - カーソル位置までの線
 * - 閉じる線（プレビュー）
 * - 頂点マーカー
 */

import { memo, useMemo } from 'react';
import { Line, Group } from 'react-konva';
import { VertexMarker } from './VertexMarker';
import type { Vertex } from '@/features/polygon/types';

/**
 * PolygonPreview Props
 */
interface PolygonPreviewProps {
  /** 配置済みの頂点配列 */
  vertices: Vertex[];
  /** 現在のカーソル位置（グリッド単位） */
  cursorPosition: Vertex | null;
  /** グリッドセルサイズ（ピクセル） */
  gridSize: number;
  /** 頂点クリックハンドラ */
  onVertexClick?: (index: number) => void;
  /** 最初の頂点クリックハンドラ（ポリゴンを閉じる） */
  onFirstVertexClick?: () => void;
}

/**
 * 線のスタイル定数
 */
const LINE_STYLE = {
  /** 描画済み線の色 */
  strokeColor: '#3b82f6',
  /** 描画済み線の太さ */
  strokeWidth: 2,
  /** プレビュー線の太さ */
  previewStrokeWidth: 1,
  /** 閉じる線のダッシュパターン */
  dashPattern: [5, 5] as number[],
  /** 閉じる線の透明度 */
  closingLineOpacity: 0.5,
} as const;

/**
 * ポリゴンプレビューコンポーネント
 *
 * 描画中のポリゴンを線と頂点マーカーで表示する。
 * カーソル位置に応じて次の頂点への線をプレビューする。
 */
export const PolygonPreview = memo(
  ({
    vertices,
    cursorPosition,
    gridSize,
    onVertexClick,
    onFirstVertexClick,
  }: PolygonPreviewProps) => {
    /**
     * 描画済み頂点間の線のポイント配列
     * カーソル位置がある場合はそこまで線を延長
     */
    const linePoints = useMemo(() => {
      const points: number[] = [];

      // 配置済み頂点をポイント配列に追加
      for (const v of vertices) {
        points.push(v.x * gridSize, v.y * gridSize);
      }

      // カーソル位置まで線を延長
      if (cursorPosition && vertices.length > 0) {
        points.push(cursorPosition.x * gridSize, cursorPosition.y * gridSize);
      }

      return points;
    }, [vertices, cursorPosition, gridSize]);

    /**
     * 閉じる線（カーソル位置から最初の頂点への点線）
     * 3頂点以上でカーソル位置がある場合のみ表示
     */
    const closingLine = useMemo(() => {
      if (vertices.length < 3 || !cursorPosition) return null;

      return [
        cursorPosition.x * gridSize,
        cursorPosition.y * gridSize,
        vertices[0].x * gridSize,
        vertices[0].y * gridSize,
      ];
    }, [vertices, cursorPosition, gridSize]);

    /**
     * ポリゴンを閉じられるか（3頂点以上）
     */
    const canClose = vertices.length >= 3;

    return (
      <Group>
        {/* 描画済みの線（頂点が2つ以上で表示） */}
        {linePoints.length >= 4 && (
          <Line
            points={linePoints}
            stroke={LINE_STYLE.strokeColor}
            strokeWidth={LINE_STYLE.strokeWidth}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}

        {/* 閉じる線（プレビュー） */}
        {closingLine && (
          <Line
            points={closingLine}
            stroke={LINE_STYLE.strokeColor}
            strokeWidth={LINE_STYLE.previewStrokeWidth}
            dash={LINE_STYLE.dashPattern}
            opacity={LINE_STYLE.closingLineOpacity}
            listening={false}
          />
        )}

        {/* 頂点マーカー */}
        {vertices.map((v, index) => (
          <VertexMarker
            key={index}
            x={v.x}
            y={v.y}
            gridSize={gridSize}
            index={index}
            isFirst={index === 0 && canClose}
            onClick={
              index === 0 && canClose
                ? onFirstVertexClick
                : () => onVertexClick?.(index)
            }
          />
        ))}
      </Group>
    );
  }
);

PolygonPreview.displayName = 'PolygonPreview';
