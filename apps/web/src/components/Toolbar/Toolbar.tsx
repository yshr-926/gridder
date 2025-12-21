import { useCallback } from 'react';
import { IconButton, Divider, Tooltip } from '../ui';
import {
  PencilIcon,
  CursorIcon,
  EraserIcon,
  ZoomInIcon,
  ZoomOutIcon,
  PolygonIcon,
  MinusIcon,
} from '../icons';
import { useCanvasStore, useGridSettingsStore } from '../../stores';
import type { ToolMode } from '../../types';

/**
 * 標準ツール項目（常に有効）
 */
const TOOL_ITEMS: { mode: ToolMode; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { mode: 'draw', icon: <PencilIcon className="w-5 h-5" />, label: '描画ツール', shortcut: 'D' },
  { mode: 'select', icon: <CursorIcon className="w-5 h-5" />, label: '選択ツール', shortcut: 'V' },
  { mode: 'eraser', icon: <EraserIcon className="w-5 h-5" />, label: '消しゴム', shortcut: 'E' },
  {
    mode: 'polygon',
    icon: <PolygonIcon className="w-5 h-5" />,
    label: 'ポリゴン描画',
    shortcut: 'P',
  },
];

/**
 * 減算ツール（オブジェクト選択時のみ有効）
 */
const SUBTRACT_TOOL = {
  mode: 'subtract' as const,
  icon: <MinusIcon className="w-5 h-5" />,
  label: '減算モード',
  shortcut: 'M',
};

export const Toolbar = () => {
  const toolMode = useCanvasStore((state) => state.toolMode);
  const setToolMode = useCanvasStore((state) => state.setToolMode);
  const selectedObjectId = useCanvasStore((state) => state.selectedObjectId);
  const zoom = useGridSettingsStore((state) => state.zoom);
  const zoomIn = useGridSettingsStore((state) => state.zoomIn);
  const zoomOut = useGridSettingsStore((state) => state.zoomOut);

  // 減算モードが利用可能かどうか（オブジェクト選択時のみ）
  const isSubtractAvailable = selectedObjectId !== null;

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

        {/* 減算ツール（オブジェクト選択時のみ有効） */}
        <Tooltip
          content={
            isSubtractAvailable
              ? `${SUBTRACT_TOOL.label} (${SUBTRACT_TOOL.shortcut})`
              : `${SUBTRACT_TOOL.label} (オブジェクトを選択してください)`
          }
          position="right"
        >
          <IconButton
            icon={SUBTRACT_TOOL.icon}
            label={SUBTRACT_TOOL.label}
            active={toolMode === SUBTRACT_TOOL.mode}
            onClick={() => setToolMode(SUBTRACT_TOOL.mode)}
            disabled={!isSubtractAvailable}
            tabIndex={toolMode === SUBTRACT_TOOL.mode ? 0 : -1}
            role="radio"
            aria-checked={toolMode === SUBTRACT_TOOL.mode}
          />
        </Tooltip>
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
