import { memo, useMemo } from 'react';
import { Group, Line, Text, Rect } from 'react-konva';
import type { Presence, CollaboratorInfo } from '@/features/collaboration/types';

/**
 * RemoteCursor Props
 */
interface RemoteCursorProps {
  /** 共同編集者情報 */
  collaborator: CollaboratorInfo;
  /** プレゼンス情報 */
  presence: Presence;
  /** グリッドサイズ（ピクセル） */
  gridSize: number;
}

/**
 * ラベルの設定
 */
const LABEL_FONT_SIZE = 11;
const LABEL_PADDING_X = 4;
const LABEL_PADDING_Y = 3;
const LABEL_HEIGHT = 18;
const LABEL_CHAR_WIDTH = 7;
const LABEL_OFFSET_X = 15;
const LABEL_OFFSET_Y = 5;
const LABEL_CORNER_RADIUS = 3;

/**
 * RemoteCursor コンポーネント
 * 他の参加者のカーソルを表示する
 */
export const RemoteCursor = memo(
  ({ collaborator, presence, gridSize }: RemoteCursorProps) => {
    const { cursor } = presence;

    // グリッド座標からピクセル座標に変換（フックの前に計算が必要なため、デフォルト値を使用）
    const pixelX = cursor ? cursor.x * gridSize : 0;
    const pixelY = cursor ? cursor.y * gridSize : 0;

    /**
     * カーソル矢印の形状を計算
     * 矢印は上向きの三角形に似た形状
     */
    const cursorShape = useMemo(
      () => [
        pixelX, pixelY,                    // 先端
        pixelX + 12, pixelY + 10,          // 右下
        pixelX + 7, pixelY + 10,           // 内側右
        pixelX + 10, pixelY + 16,          // 尾部右
        pixelX + 6, pixelY + 17,           // 尾部左
        pixelX + 4, pixelY + 11,           // 内側左
        pixelX, pixelY + 14,               // 左下
      ],
      [pixelX, pixelY]
    );

    /**
     * ラベルの幅を計算
     */
    const labelWidth = useMemo(
      () => collaborator.displayName.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X * 2,
      [collaborator.displayName]
    );

    // カーソルがない場合は非表示
    if (!cursor) return null;

    return (
      <Group listening={false}>
        {/* カーソル矢印 */}
        <Line
          points={cursorShape}
          fill={collaborator.color}
          stroke="#ffffff"
          strokeWidth={1}
          closed
          listening={false}
        />

        {/* 名前ラベル */}
        <Group x={pixelX + LABEL_OFFSET_X} y={pixelY + LABEL_OFFSET_Y}>
          {/* 背景 */}
          <Rect
            x={0}
            y={0}
            width={labelWidth}
            height={LABEL_HEIGHT}
            fill={collaborator.color}
            cornerRadius={LABEL_CORNER_RADIUS}
            listening={false}
          />
          {/* テキスト */}
          <Text
            x={LABEL_PADDING_X}
            y={LABEL_PADDING_Y}
            text={collaborator.displayName}
            fontSize={LABEL_FONT_SIZE}
            fill="#ffffff"
            fontStyle="bold"
            listening={false}
          />
        </Group>
      </Group>
    );
  }
);

RemoteCursor.displayName = 'RemoteCursor';
