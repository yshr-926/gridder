import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { TextPosition } from '@/types';

const TEXT_POSITION_OPTIONS: { value: TextPosition; label: string }[] = [
  { value: 'center', label: '中央' },
  { value: 'top', label: '上部' },
  { value: 'bottom', label: '下部' },
  { value: 'inside', label: '内部' },
];

export const TextDisplaySettings = () => {
  const { showObjectNames, textSettings, setShowObjectNames, setTextSettings } = useUIStore();

  const handleToggle = useCallback(() => {
    setShowObjectNames(!showObjectNames);
  }, [showObjectNames, setShowObjectNames]);

  const handlePositionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTextSettings({ textPosition: e.target.value as TextPosition });
    },
    [setTextSettings]
  );

  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (!isNaN(value) && value >= 8 && value <= 32) {
        setTextSettings({ fontSize: value });
      }
    },
    [setTextSettings]
  );

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTextSettings({ textColor: e.target.value });
    },
    [setTextSettings]
  );

  return (
    <div className="p-4 border-b border-gray-200">
      <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
        テキスト表示設定
      </h2>

      <div className="space-y-4">
        {/* 表示切り替え */}
        <div className="flex items-center gap-2">
          <input
            id="show-object-names"
            type="checkbox"
            checked={showObjectNames}
            onChange={handleToggle}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="show-object-names" className="text-sm text-gray-700">
            オブジェクト名を表示
          </label>
        </div>

        {/* テキスト位置 */}
        <div className="space-y-2">
          <label
            htmlFor="text-position"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            テキスト位置
          </label>
          <select
            id="text-position"
            value={textSettings.textPosition}
            onChange={handlePositionChange}
            disabled={!showObjectNames}
            className="
              w-full px-3 py-2
              text-sm text-gray-800
              bg-white border border-gray-300 rounded-md
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-100 disabled:text-gray-500
            "
          >
            {TEXT_POSITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* フォントサイズ */}
        <div className="space-y-2">
          <label
            htmlFor="text-font-size"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            フォントサイズ
          </label>
          <input
            id="text-font-size"
            type="number"
            min="8"
            max="32"
            value={textSettings.fontSize}
            onChange={handleFontSizeChange}
            disabled={!showObjectNames}
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
            htmlFor="text-color"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            テキスト色
          </label>
          <input
            id="text-color"
            type="color"
            value={textSettings.textColor}
            onChange={handleColorChange}
            disabled={!showObjectNames}
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
