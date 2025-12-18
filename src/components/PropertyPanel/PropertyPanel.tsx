import { Button, Input, Select, Divider, IconButton } from '../ui';
import {
  RotateIcon,
  CopyIcon,
  TrashIcon,
  DownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../icons';
import { useCanvasStore, useGridSettingsStore, useUIStore } from '../../stores';
import type { Unit } from '../../types';
import { cn } from '../../utils/cn';

const UNIT_OPTIONS = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'm', label: 'm' },
];

interface PropertyPanelProps {
  onExportJSON: () => void;
  onExportPNG: () => void;
  onExportJPEG: () => void;
}

export const PropertyPanel = ({
  onExportJSON,
  onExportPNG,
  onExportJPEG,
}: PropertyPanelProps) => {
  const isOpen = useUIStore((state) => state.isPropertyPanelOpen);
  const togglePanel = useUIStore((state) => state.togglePropertyPanel);

  const cellSize = useGridSettingsStore((state) => state.cellSize);
  const setCellSize = useGridSettingsStore((state) => state.setCellSize);
  const unit = useGridSettingsStore((state) => state.unit);
  const setUnit = useGridSettingsStore((state) => state.setUnit);

  const selectedObjectId = useCanvasStore((state) => state.selectedObjectId);
  const objects = useCanvasStore((state) => state.objects);
  const updateObject = useCanvasStore((state) => state.updateObject);
  const removeObject = useCanvasStore((state) => state.removeObject);
  const duplicateObject = useCanvasStore((state) => state.duplicateObject);

  const selectedObject = selectedObjectId
    ? objects.find((obj) => obj.id === selectedObjectId)
    : null;

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

  const handleCellSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setCellSize(value);
    }
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUnit(e.target.value as Unit);
  };

  return (
    <aside
      className={cn(
        'border-l border-gray-200 bg-white flex flex-col transition-all duration-200',
        isOpen ? 'w-64' : 'w-12'
      )}
      role="complementary"
      aria-label="プロパティパネル"
    >
      {/* Toggle Button */}
      <button
        onClick={togglePanel}
        className="h-10 flex items-center justify-center border-b border-gray-200 hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
        aria-controls="property-panel-content"
        aria-label={isOpen ? 'パネルを閉じる' : 'パネルを開く'}
      >
        {isOpen ? (
          <ChevronRightIcon className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Panel Content */}
      <div
        id="property-panel-content"
        className={cn('flex-1 overflow-y-auto', !isOpen && 'hidden')}
      >
        {/* Scale Settings */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
            スケール設定
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">1マス =</span>
            <Input
              type="number"
              inputSize="sm"
              value={cellSize}
              onChange={handleCellSizeChange}
              className="w-16 text-center"
              min={1}
              aria-label="セルサイズ"
            />
            <Select
              options={UNIT_OPTIONS}
              selectSize="sm"
              value={unit}
              onChange={handleUnitChange}
              className="w-20"
              aria-label="単位"
            />
          </div>
        </div>

        {/* Selected Object Properties */}
        {selectedObject && (
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
              選択中のオブジェクト
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">セル数:</span>
                <span className="text-gray-800">{selectedObject.cells.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">回転:</span>
                <span className="text-gray-800">{selectedObject.rotation}°</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <IconButton
                icon={<RotateIcon className="w-4 h-4" />}
                label="90度回転"
                size="sm"
                onClick={handleRotate}
              />
              <IconButton
                icon={<CopyIcon className="w-4 h-4" />}
                label="複製"
                size="sm"
                onClick={handleDuplicate}
              />
              <IconButton
                icon={<TrashIcon className="w-4 h-4" />}
                label="削除"
                size="sm"
                onClick={handleDelete}
              />
            </div>
          </div>
        )}

        {/* Export Section */}
        <div className="p-4">
          <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
            エクスポート
          </h2>
          <div className="space-y-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={onExportJSON}
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              JSON で保存
            </Button>
            <Divider className="my-2" />
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={onExportPNG}
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              PNG で書き出し
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={onExportJPEG}
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              JPEG で書き出し
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};
