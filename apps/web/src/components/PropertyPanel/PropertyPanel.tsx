import { Copy, RotateCw, Trash2 } from 'lucide-react';
import { IconButton } from '../ui';
import { useCanvasStore } from '../../stores';
import { DecorationSettings } from './DecorationSettings';
import { ObjectNameEditor } from './ObjectNameEditor';
import { TextDisplaySettings } from './TextDisplaySettings';
import { DimensionDisplaySettings } from './DimensionDisplaySettings';
import { GroupPanel } from './GroupPanel';

export const PropertyPanel = () => {
  const selectedObjectId = useCanvasStore(state => state.selectedObjectId);
  const objects = useCanvasStore(state => state.objects);
  const updateObject = useCanvasStore(state => state.updateObject);
  const removeObject = useCanvasStore(state => state.removeObject);
  const duplicateObject = useCanvasStore(state => state.duplicateObject);

  const selectedObject = selectedObjectId ? objects.find(obj => obj.id === selectedObjectId) : null;

  const handleRotate = () => {
    if (!selectedObject) return;
    const newRotation = ((selectedObject.rotation + 90) % 360) as 0 | 90 | 180 | 270;
    updateObject(selectedObject.id, { rotation: newRotation });
  };

  const handleDuplicate = () => {
    if (!selectedObjectId) return;
    duplicateObject(selectedObjectId);
  };

  const handleDelete = () => {
    if (!selectedObjectId) return;
    removeObject(selectedObjectId);
  };

  if (!selectedObject) {
    return null;
  }

  return (
    <aside
      className="flex w-inspector shrink-0 animate-inspector-in flex-col overflow-y-auto border-l border-ui-border bg-surface"
      role="complementary"
      aria-label="図形インスペクター"
    >
      <div className="border-b border-ui-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ui">選択中の図形</h2>
      </div>

      <div className="flex-1">
        <ObjectNameEditor selectedObjectId={selectedObjectId} />
        <DecorationSettings selectedObjectId={selectedObjectId} />

        <div className="border-b border-ui-border p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-ui-muted">図形</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ui-muted">セル数</span>
              <span className="tabular-nums text-ui">{selectedObject.cells.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ui-muted">回転</span>
              <span className="tabular-nums text-ui">{selectedObject.rotation}°</span>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            <IconButton
              icon={<RotateCw aria-hidden="true" className="size-4" />}
              label="90度回転"
              size="sm"
              onClick={handleRotate}
            />
            <IconButton
              icon={<Copy aria-hidden="true" className="size-4" />}
              label="複製"
              size="sm"
              onClick={handleDuplicate}
            />
            <IconButton
              icon={<Trash2 aria-hidden="true" className="size-4" />}
              label="削除"
              size="sm"
              onClick={handleDelete}
            />
          </div>
        </div>

        <TextDisplaySettings />
        <DimensionDisplaySettings />
        <GroupPanel />
      </div>
    </aside>
  );
};
