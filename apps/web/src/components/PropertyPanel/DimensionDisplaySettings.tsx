import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { DimensionDisplayMode } from '@/types';

const DIMENSION_MODE_OPTIONS: { value: DimensionDisplayMode; label: string }[] = [
  { value: 'none', label: '非表示' },
  { value: 'size', label: 'サイズ（幅×高さ）' },
  { value: 'edges', label: '各辺の長さ' },
  { value: 'both', label: '両方' },
];

export const DimensionDisplaySettings = () => {
  const { showDimensions, dimensionSettings, setShowDimensions, setDimensionSettings } =
    useUIStore();

  const handleToggle = useCallback(() => {
    setShowDimensions(!showDimensions);
  }, [showDimensions, setShowDimensions]);

  const handleModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setDimensionSettings({ displayMode: e.target.value as DimensionDisplayMode });
    },
    [setDimensionSettings]
  );

  const handleLinesToggle = useCallback(() => {
    setDimensionSettings({ showDimensionLines: !dimensionSettings.showDimensionLines });
  }, [dimensionSettings.showDimensionLines, setDimensionSettings]);

  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (!isNaN(value) && value >= 8 && value <= 24) {
        setDimensionSettings({ fontSize: value });
      }
    },
    [setDimensionSettings]
  );

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDimensionSettings({ textColor: e.target.value });
    },
    [setDimensionSettings]
  );

  return (
    <div className="p-4 border-b border-gray-200">
      <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
        寸法表示設定
      </h2>

      <div className="space-y-4">
        {/* 表示切り替え */}
        <div className="flex items-center gap-2">
          <input
            id="show-dimensions"
            type="checkbox"
            checked={showDimensions}
            onChange={handleToggle}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="show-dimensions" className="text-sm text-gray-700">
            寸法を表示
          </label>
        </div>

        {/* 表示モード */}
        <div className="space-y-2">
          <label
            htmlFor="dimension-mode"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            表示モード
          </label>
          <select
            id="dimension-mode"
            value={dimensionSettings.displayMode}
            onChange={handleModeChange}
            disabled={!showDimensions}
            className="
              w-full px-3 py-2
              text-sm text-gray-800
              bg-white border border-gray-300 rounded-md
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-100 disabled:text-gray-500
            "
          >
            {DIMENSION_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 寸法線 */}
        <div className="flex items-center gap-2">
          <input
            id="show-dimension-lines"
            type="checkbox"
            checked={dimensionSettings.showDimensionLines}
            onChange={handleLinesToggle}
            disabled={!showDimensions}
            className="w-4 h-4 rounded border-gray-300 disabled:opacity-50"
          />
          <label
            htmlFor="show-dimension-lines"
            className={`text-sm ${showDimensions ? 'text-gray-700' : 'text-gray-400'}`}
          >
            寸法線を表示
          </label>
        </div>

        {/* フォントサイズ */}
        <div className="space-y-2">
          <label
            htmlFor="dimension-font-size"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            フォントサイズ
          </label>
          <input
            id="dimension-font-size"
            type="number"
            min="8"
            max="24"
            value={dimensionSettings.fontSize}
            onChange={handleFontSizeChange}
            disabled={!showDimensions}
            className="
              w-full px-3 py-2
              text-sm text-gray-800
              bg-white border border-gray-300 rounded-md
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-100 disabled:text-gray-500
            "
          />
        </div>

        {/* テキスト色 */}
        <div className="space-y-2">
          <label
            htmlFor="dimension-color"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            テキスト色
          </label>
          <input
            id="dimension-color"
            type="color"
            value={dimensionSettings.textColor}
            onChange={handleColorChange}
            disabled={!showDimensions}
            className="
              w-full h-10
              bg-white border border-gray-300 rounded-md
              cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />
        </div>
      </div>
    </div>
  );
};
