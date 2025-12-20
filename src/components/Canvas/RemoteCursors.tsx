import { memo } from 'react';
import { Group } from 'react-konva';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { RemoteCursor } from './RemoteCursor';

/**
 * RemoteCursors Props
 */
interface RemoteCursorsProps {
  /** グリッドサイズ（ピクセル） */
  gridSize: number;
}

/**
 * RemoteCursors コンポーネント
 * 全ての参加者のカーソルを一覧表示する
 */
export const RemoteCursors = memo(({ gridSize }: RemoteCursorsProps) => {
  const collaborators = useCollaborationStore((state) => state.collaborators);
  const presences = useCollaborationStore((state) => state.presences);

  return (
    <Group listening={false}>
      {collaborators.map((collaborator) => {
        const presence = presences.get(collaborator.id);
        if (!presence) return null;

        return (
          <RemoteCursor
            key={collaborator.id}
            collaborator={collaborator}
            presence={presence}
            gridSize={gridSize}
          />
        );
      })}
    </Group>
  );
});

RemoteCursors.displayName = 'RemoteCursors';
