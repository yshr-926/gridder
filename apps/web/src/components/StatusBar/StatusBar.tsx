import { useCanvasStore, useGridSettingsStore } from '../../stores';

interface StatusBarProps {
  cursorPosition?: { x: number; y: number } | null;
}

export const StatusBar = ({ cursorPosition }: StatusBarProps) => {
  const cellSize = useGridSettingsStore((state) => state.cellSize);
  const unit = useGridSettingsStore((state) => state.unit);
  const zoom = useGridSettingsStore((state) => state.zoom);
  const objects = useCanvasStore((state) => state.objects);

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <footer
      className="h-6 border-t border-gray-200 bg-gray-50 px-4 flex items-center justify-between text-xs text-gray-500"
      role="status"
      aria-label="ステータスバー"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="flex items-center gap-4">
        {/* Scale Display */}
        <span>
          1マス = {cellSize}
          {unit}
        </span>

        {/* Zoom Display */}
        <span>ズーム: {zoomPercentage}%</span>

        {/* Cursor Position */}
        {cursorPosition && (
          <span>
            位置: ({cursorPosition.x}, {cursorPosition.y})
          </span>
        )}
      </div>

      {/* Object Count */}
      <span>オブジェクト: {objects.length}個</span>
    </footer>
  );
};
