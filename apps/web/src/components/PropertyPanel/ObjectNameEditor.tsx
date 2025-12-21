import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';

interface ObjectNameEditorProps {
  selectedObjectId: string | null;
}

export const ObjectNameEditor = ({ selectedObjectId }: ObjectNameEditorProps) => {
  const { objects, updateObject } = useCanvasStore();

  const selectedObject = selectedObjectId
    ? objects.find((o) => o.id === selectedObjectId)
    : null;

  // 直接ストアから値を取得（ローカル状態なしで制御コンポーネントとして動作）
  const name = selectedObject?.name ?? '';
  const description = selectedObject?.description ?? '';

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      if (selectedObjectId) {
        updateObject(selectedObjectId, { name: newName || undefined });
      }
    },
    [selectedObjectId, updateObject]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newDescription = e.target.value;
      if (selectedObjectId) {
        updateObject(selectedObjectId, { description: newDescription || undefined });
      }
    },
    [selectedObjectId, updateObject]
  );

  if (!selectedObject) {
    return (
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
          オブジェクト情報
        </h2>
        <div className="text-sm text-gray-500 italic">
          オブジェクトを選択してください
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-200">
      <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
        オブジェクト情報
      </h2>

      <div className="space-y-4">
        {/* オブジェクト名 */}
        <div className="space-y-2">
          <label
            htmlFor="object-name"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            オブジェクト名
          </label>
          <input
            id="object-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="名前を入力"
            className="
              w-full px-3 py-2
              text-sm text-gray-800
              bg-white border border-gray-300 rounded-md
              placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
          />
        </div>

        {/* 説明 */}
        <div className="space-y-2">
          <label
            htmlFor="object-description"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            説明
          </label>
          <textarea
            id="object-description"
            value={description}
            onChange={handleDescriptionChange}
            placeholder="説明を入力"
            rows={3}
            className="
              w-full px-3 py-2
              text-sm text-gray-800
              bg-white border border-gray-300 rounded-md
              placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              resize-none
            "
          />
        </div>
      </div>
    </div>
  );
};
