import { memo, useMemo } from 'react';
import { Text, Group } from 'react-konva';
import type { GridObject, ObjectTextSettings } from '@/types';
import { DEFAULT_TEXT_SETTINGS } from '@/types';
import { calculateBoundingBox } from '@/utils/dimension';

/**
 * ObjectTextLabel Props
 */
interface ObjectTextLabelProps {
  /** グリッドオブジェクト */
  object: GridObject;
  /** グリッドサイズ（ピクセル） */
  gridSize: number;
  /** グローバル設定（UIストアから渡される） */
  settings: ObjectTextSettings;
}

/**
 * オブジェクト名を表示するコンポーネント
 * 注: 表示/非表示の制御は呼び出し元（GridObjectShape）で行う
 */
export const ObjectTextLabel = memo(
  ({ object, gridSize, settings }: ObjectTextLabelProps) => {
    const { cells, name } = object;

    // グローバル設定をデフォルトとマージ
    const textSettings = useMemo(
      () => ({
        ...DEFAULT_TEXT_SETTINGS,
        ...settings,
      }),
      [settings]
    );

    const bbox = useMemo(() => calculateBoundingBox(cells), [cells]);

    // テキストの位置を計算
    const position = useMemo(() => {
      const centerX = (bbox.minX + bbox.width / 2) * gridSize;
      const centerY = (bbox.minY + bbox.height / 2) * gridSize;

      switch (textSettings.textPosition) {
        case 'top':
          return { x: centerX, y: bbox.minY * gridSize - textSettings.fontSize - 4 };
        case 'bottom':
          return { x: centerX, y: (bbox.maxY + 1) * gridSize + 4 };
        case 'inside':
        case 'center':
        default:
          return { x: centerX, y: centerY };
      }
    }, [bbox, gridSize, textSettings.textPosition, textSettings.fontSize]);

    // テキスト幅の推定（日本語文字は約0.6em、英数字は約0.5em）
    const estimatedWidth = useMemo(() => {
      if (!name) return 0;
      return name.length * textSettings.fontSize * 0.6;
    }, [name, textSettings.fontSize]);

    // テキストがない場合は何も表示しない
    if (!name) return null;

    return (
      <Group>
        <Text
          x={position.x}
          y={position.y}
          text={name}
          fontSize={textSettings.fontSize}
          fill={textSettings.textColor}
          align="center"
          verticalAlign="middle"
          offsetX={estimatedWidth / 2}
          offsetY={textSettings.fontSize / 2}
          listening={false}
        />
      </Group>
    );
  }
);

ObjectTextLabel.displayName = 'ObjectTextLabel';
