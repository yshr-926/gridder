import { memo, useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useCanvasStore } from '@/stores/canvasStore';

/**
 * RemoteSelection Props
 */
interface RemoteSelectionProps {
  /** グリッドサイズ（ピクセル） */
  gridSize: number;
}

/**
 * 選択ハイライトの設定
 */
const SELECTION_STROKE_WIDTH = 2;
const SELECTION_DASH = [5, 5];

/**
 * RemoteSelection コンポーネント
 * 他の参加者が選択しているオブジェクトをハイライト表示する
 */
export const RemoteSelection = memo(({ gridSize }: RemoteSelectionProps) => {
  const collaborators = useCollaborationStore((state) => state.collaborators);
  const presences = useCollaborationStore((state) => state.presences);
  const objects = useCanvasStore((state) => state.objects);

  /**
   * 選択ハイライトを計算
   */
  const selectionHighlights = useMemo(() => {
    const highlights: Array<{
      key: string;
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }> = [];

    collaborators.forEach((collaborator) => {
      const presence = presences.get(collaborator.id);
      if (!presence || presence.selectedObjectIds.length === 0) return;

      presence.selectedObjectIds.forEach((objectId) => {
        const obj = objects.find((o) => o.id === objectId);
        if (!obj || obj.cells.length === 0) return;

        // オブジェクトの境界ボックスを計算
        const minX = Math.min(...obj.cells.map(([x]) => x));
        const minY = Math.min(...obj.cells.map(([, y]) => y));
        const maxX = Math.max(...obj.cells.map(([x]) => x));
        const maxY = Math.max(...obj.cells.map(([, y]) => y));

        const x = (obj.position.x + minX) * gridSize;
        const y = (obj.position.y + minY) * gridSize;
        const width = (maxX - minX + 1) * gridSize;
        const height = (maxY - minY + 1) * gridSize;

        highlights.push({
          key: `${collaborator.id}-${objectId}`,
          x,
          y,
          width,
          height,
          color: collaborator.color,
        });
      });
    });

    return highlights;
  }, [collaborators, presences, objects, gridSize]);

  return (
    <Group listening={false}>
      {selectionHighlights.map((highlight) => (
        <Rect
          key={highlight.key}
          x={highlight.x}
          y={highlight.y}
          width={highlight.width}
          height={highlight.height}
          stroke={highlight.color}
          strokeWidth={SELECTION_STROKE_WIDTH}
          dash={SELECTION_DASH}
          listening={false}
        />
      ))}
    </Group>
  );
});

RemoteSelection.displayName = 'RemoteSelection';
