import { useState, useCallback } from 'react';
import { useGroupStore } from '@/stores/groupStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useMultiSelection } from '@/features/selection/useMultiSelection';

/**
 * GroupPanel コンポーネント
 *
 * グループ化機能のUI:
 * - グループ化/解除ボタン
 * - グループ一覧表示
 * - グループ名編集
 * - グループ選択/削除
 */
export const GroupPanel = () => {
  const { groups, deleteGroup, renameGroup, selectGroup, createGroup } =
    useGroupStore();
  const { selection } = useCanvasStore();
  const { deleteSelectedObjects, duplicateSelectedObjects } = useMultiSelection();

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  /**
   * グループ化ハンドラ
   */
  const handleCreateGroup = useCallback(() => {
    if (selection.selectedIds.length < 2) {
      return;
    }
    createGroup(selection.selectedIds);
  }, [selection.selectedIds, createGroup]);

  /**
   * 選択中のオブジェクトが属するグループを解除
   */
  const handleUngroupSelected = useCallback(() => {
    const groupsToDelete = new Set<string>();

    for (const id of selection.selectedIds) {
      const group = useGroupStore.getState().getGroupByObjectId(id);
      if (group) {
        groupsToDelete.add(group.id);
      }
    }

    for (const groupId of groupsToDelete) {
      deleteGroup(groupId);
    }
  }, [selection.selectedIds, deleteGroup]);

  /**
   * グループ名編集開始
   */
  const handleStartEdit = useCallback((groupId: string, currentName?: string) => {
    setEditingGroupId(groupId);
    setEditingName(currentName ?? '');
  }, []);

  /**
   * グループ名編集保存
   */
  const handleSaveEdit = useCallback(
    (groupId: string) => {
      if (editingName.trim()) {
        renameGroup(groupId, editingName.trim());
      }
      setEditingGroupId(null);
      setEditingName('');
    },
    [editingName, renameGroup]
  );

  /**
   * グループ名編集キャンセル
   */
  const handleCancelEdit = useCallback(() => {
    setEditingGroupId(null);
    setEditingName('');
  }, []);

  /**
   * グループ選択ハンドラ
   */
  const handleSelectGroup = useCallback(
    (groupId: string) => {
      selectGroup(groupId);
    },
    [selectGroup]
  );

  /**
   * グループ削除ハンドラ
   */
  const handleDeleteGroup = useCallback(
    (groupId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteGroup(groupId);
    },
    [deleteGroup]
  );

  /**
   * 選択中のオブジェクトがグループに属しているかチェック
   */
  const selectedObjectsInGroup = selection.selectedIds.some((id) =>
    useGroupStore.getState().getGroupByObjectId(id)
  );

  const isMultipleSelected = selection.selectedIds.length > 1;
  const hasSelection = selection.selectedIds.length > 0;

  return (
    <div className="p-4 border-b border-gray-200 space-y-4">
      {/* 複数選択時のアクション */}
      {isMultipleSelected && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            選択操作
          </label>
          <div className="flex gap-2">
            <button
              onClick={duplicateSelectedObjects}
              className="
                flex-1 px-3 py-2
                text-sm font-medium text-gray-700
                bg-gray-100 rounded
                hover:bg-gray-200 transition-colors
              "
              title="選択オブジェクトを複製 (Ctrl/Cmd + D)"
            >
              複製
            </button>
            <button
              onClick={deleteSelectedObjects}
              className="
                flex-1 px-3 py-2
                text-sm font-medium text-gray-700
                bg-gray-100 rounded
                hover:bg-gray-200 transition-colors
              "
              title="選択オブジェクトを削除 (Delete/Backspace)"
            >
              削除
            </button>
          </div>
        </div>
      )}

      {/* グループ化アクション */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          グループ操作
        </label>
        <div className="flex gap-2">
          <button
            onClick={handleCreateGroup}
            disabled={!isMultipleSelected}
            className="
              flex-1 px-3 py-2
              text-sm font-medium text-gray-700
              bg-gray-100 rounded
              hover:bg-gray-200 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            title="選択オブジェクトをグループ化 (Ctrl/Cmd + G)"
          >
            グループ化
          </button>
          <button
            onClick={handleUngroupSelected}
            disabled={!hasSelection || !selectedObjectsInGroup}
            className="
              flex-1 px-3 py-2
              text-sm font-medium text-gray-700
              bg-gray-100 rounded
              hover:bg-gray-200 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            title="グループ解除 (Ctrl/Cmd + Shift + G)"
          >
            グループ解除
          </button>
        </div>
      </div>

      {/* グループ一覧 */}
      {groups.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            グループ一覧
          </label>
          <div className="space-y-1">
            {groups.map((group) => (
              <div
                key={group.id}
                className="
                  flex items-center justify-between
                  px-3 py-2 bg-gray-50 rounded
                  hover:bg-gray-100 cursor-pointer
                "
                onClick={() => handleSelectGroup(group.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectGroup(group.id);
                  }
                }}
              >
                {editingGroupId === group.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleSaveEdit(group.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEdit(group.id);
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="
                      flex-1 px-2 py-1
                      text-sm text-gray-700
                      border border-gray-300 rounded
                      focus:outline-none focus:border-blue-500
                    "
                    autoFocus
                    placeholder="グループ名"
                    aria-label="グループ名を編集"
                  />
                ) : (
                  <span
                    className="text-sm text-gray-700 flex-1"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(group.id, group.name);
                    }}
                    title="ダブルクリックで名前を編集"
                  >
                    {group.name || `グループ (${group.objectIds.length})`}
                  </span>
                )}
                <button
                  onClick={(e) => handleDeleteGroup(group.id, e)}
                  className="
                    ml-2 text-gray-400 hover:text-red-500
                    transition-colors p-1
                  "
                  aria-label="グループを削除"
                  title="グループを削除"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
