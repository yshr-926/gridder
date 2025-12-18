import { useCallback } from 'react';
import { IconButton, Divider, Tooltip } from '../ui';
import { PencilIcon, CursorIcon, EraserIcon, ZoomInIcon, ZoomOutIcon } from '../icons';
import { useCanvasStore, useGridSettingsStore } from '../../stores';
import type { ToolMode } from '../../types';

const TOOL_ITEMS: { mode: ToolMode; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { mode: 'draw', icon: <PencilIcon className="w-5 h-5" />, label: '描画ツール', shortcut: 'D' },
  { mode: 'select', icon: <CursorIcon className="w-5 h-5" />, label: '選択ツール', shortcut: 'V' },
  { mode: 'eraser', icon: <EraserIcon className="w-5 h-5" />, label: '消しゴム', shortcut: 'E' },
];

export const Toolbar = () => {
  const toolMode = useCanvasStore((state) => state.toolMode);
  const setToolMode = useCanvasStore((state) => state.setToolMode);
  const zoom = useGridSettingsStore((state) => state.zoom);
  const zoomIn = useGridSettingsStore((state) => state.zoomIn);
  const zoomOut = useGridSettingsStore((state) => state.zoomOut);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = TOOL_ITEMS.findIndex((item) => item.mode === toolMode);

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setToolMode(TOOL_ITEMS[currentIndex - 1].mode);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < TOOL_ITEMS.length - 1) {
            setToolMode(TOOL_ITEMS[currentIndex + 1].mode);
          }
          break;
      }
    },
    [toolMode, setToolMode]
  );

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <aside
      className="w-14 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-2 gap-1"
      role="toolbar"
      aria-label="描画ツール"
      onKeyDown={handleKeyDown}
    >
      {/* Tool Mode Buttons */}
      <div role="radiogroup" aria-label="描画ツール選択">
        {TOOL_ITEMS.map((item) => (
          <Tooltip
            key={item.mode}
            content={`${item.label} (${item.shortcut})`}
            position="right"
          >
            <IconButton
              icon={item.icon}
              label={item.label}
              active={toolMode === item.mode}
              onClick={() => setToolMode(item.mode)}
              tabIndex={toolMode === item.mode ? 0 : -1}
              role="radio"
              aria-checked={toolMode === item.mode}
            />
          </Tooltip>
        ))}
      </div>

      <Divider className="my-2" />

      {/* Zoom Controls */}
      <Tooltip content="ズームイン" position="right">
        <IconButton
          icon={<ZoomInIcon className="w-5 h-5" />}
          label="ズームイン"
          onClick={zoomIn}
          disabled={zoom >= 4}
        />
      </Tooltip>
      <span className="text-xs text-gray-500 my-1" aria-label={`ズーム ${zoomPercentage}%`}>
        {zoomPercentage}%
      </span>
      <Tooltip content="ズームアウト" position="right">
        <IconButton
          icon={<ZoomOutIcon className="w-5 h-5" />}
          label="ズームアウト"
          onClick={zoomOut}
          disabled={zoom <= 0.25}
        />
      </Tooltip>
    </aside>
  );
};
