import { useCanvasStore } from '@/stores/canvasStore';
import { OBJECT_COLOR_PALETTE } from '@/utils/colorPalette';
import { DEFAULT_DECORATION } from '@/types';
import type { ObjectDecoration } from '@/types';

interface DecorationSettingsProps {
  /** 選択中のオブジェクトID（nullの場合はグローバル設定） */
  selectedObjectId: string | null;
}

export const DecorationSettings = ({ selectedObjectId }: DecorationSettingsProps) => {
  const { objects, updateObject, defaultDecoration, setDefaultDecoration } = useCanvasStore();

  const selectedObject = selectedObjectId
    ? objects.find((o) => o.id === selectedObjectId)
    : null;

  // ★重要: DEFAULT_DECORATION と合成して必ず完全な ObjectDecoration を得る
  const currentDecoration: ObjectDecoration = {
    ...DEFAULT_DECORATION,
    ...defaultDecoration,
    ...(selectedObject?.decoration ?? {}),
  };

  const handleDecorationChange = (updates: Partial<ObjectDecoration>) => {
    if (selectedObjectId && selectedObject) {
      // 既存の decoration と DEFAULT_DECORATION を合成した上で更新
      const mergedDecoration: ObjectDecoration = {
        ...DEFAULT_DECORATION,
        ...selectedObject.decoration,
        ...updates,
      };
      updateObject(selectedObjectId, { decoration: mergedDecoration });
    } else {
      setDefaultDecoration(updates);
    }
  };

  const handleColorChange = (color: string) => {
    if (selectedObjectId) {
      updateObject(selectedObjectId, { color });
    }
  };

  return (
    <div className="p-4 border-b border-gray-200">
      <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
        装飾設定
      </h2>

      <div className="space-y-4">
        {/* 枠線設定 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            枠線
          </label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showBorder"
              data-testid="decoration-border-toggle"
              checked={currentDecoration.showBorder}
              onChange={(e) => handleDecorationChange({ showBorder: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="showBorder" className="text-sm text-gray-700">
              枠線を表示
            </label>
          </div>
        </div>

        {/* 透明度設定 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            透明度: {Math.round(currentDecoration.opacity * 100)}%
          </label>
          <input
            type="range"
            data-testid="decoration-opacity-slider"
            min="0.1"
            max="1"
            step="0.1"
            value={currentDecoration.opacity}
            onChange={(e) => handleDecorationChange({ opacity: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* カラーパレット（選択中オブジェクトがある場合のみ） */}
        {selectedObject && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              オブジェクト色
            </label>
            <div className="grid grid-cols-6 gap-2">
              {OBJECT_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  data-testid={`color-${color}`}
                  onClick={() => handleColorChange(color)}
                  className={`
                    w-8 h-8 rounded-md border-2 transition-all
                    ${
                      selectedObject.color === color
                        ? 'border-gray-800 ring-2 ring-gray-400'
                        : 'border-transparent hover:border-gray-300'
                    }
                  `}
                  style={{ backgroundColor: color }}
                  aria-label={`色を${color}に変更`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
