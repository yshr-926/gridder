import { create } from 'zustand';
import type { ObjectGroup } from '@/types/group';
import { generateId } from '@/utils/id';
import { useCanvasStore } from './canvasStore';

/**
 * グループ管理ストアの状態
 */
interface GroupState {
  /** 全グループ */
  groups: ObjectGroup[];

  // グループ操作
  /** グループを作成（2つ以上のオブジェクトが必要） */
  createGroup: (objectIds: string[], name?: string) => ObjectGroup | null;
  /** グループを削除 */
  deleteGroup: (groupId: string) => void;
  /** オブジェクトをグループに追加 */
  addToGroup: (groupId: string, objectId: string) => void;
  /** オブジェクトをグループから削除 */
  removeFromGroup: (groupId: string, objectId: string) => void;
  /** グループ名を変更 */
  renameGroup: (groupId: string, name: string) => void;

  // クエリ
  /** オブジェクトIDからグループを取得 */
  getGroupByObjectId: (objectId: string) => ObjectGroup | null;
  /** グループに含まれるオブジェクトIDを取得 */
  getObjectsInGroup: (groupId: string) => string[];

  // 一括操作
  /** グループ内のオブジェクトを選択 */
  selectGroup: (groupId: string) => void;
  /** グループを一括設定 */
  setGroups: (groups: ObjectGroup[]) => void;
  /** 全グループをクリア */
  clearGroups: () => void;
}

/**
 * グループ管理ストア
 *
 * 複数のオブジェクトを永続的なグループとして管理する。
 * グループは後から選択・編集でき、メンバーが1以下になった場合は自動削除される。
 */
export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],

  createGroup: (objectIds, name) => {
    // 2つ以上のオブジェクトが必要
    if (objectIds.length < 2) return null;

    const newGroup: ObjectGroup = {
      id: generateId('group'),
      objectIds: [...objectIds],
      anchorObjectId: objectIds[0],
      name,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      groups: [...state.groups, newGroup],
    }));

    return newGroup;
  },

  deleteGroup: (groupId) => {
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
    }));
  },

  addToGroup: (groupId, objectId) => {
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        // 既にグループに含まれている場合は追加しない
        if (g.objectIds.includes(objectId)) return g;
        return {
          ...g,
          objectIds: [...g.objectIds, objectId],
        };
      }),
    }));
  },

  removeFromGroup: (groupId, objectId) => {
    set((state) => ({
      groups: state.groups
        .map((g) => {
          if (g.id !== groupId) return g;

          const newObjectIds = g.objectIds.filter((id) => id !== objectId);

          // 1オブジェクト以下になったらnullを返して後でフィルタリング
          if (newObjectIds.length <= 1) {
            return null;
          }

          // アンカーが削除された場合は次のオブジェクトをアンカーに
          const newAnchor =
            g.anchorObjectId === objectId
              ? newObjectIds[0]
              : g.anchorObjectId;

          return {
            ...g,
            objectIds: newObjectIds,
            anchorObjectId: newAnchor,
          };
        })
        .filter((g): g is ObjectGroup => g !== null),
    }));
  },

  renameGroup: (groupId, name) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, name } : g
      ),
    }));
  },

  getGroupByObjectId: (objectId) => {
    return get().groups.find((g) => g.objectIds.includes(objectId)) ?? null;
  },

  getObjectsInGroup: (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    return group?.objectIds ?? [];
  },

  selectGroup: (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (group) {
      useCanvasStore.getState().selectObjects(group.objectIds);
    }
  },

  setGroups: (groups) => set({ groups }),
  clearGroups: () => set({ groups: [] }),
}));

// 開発モードでストアを公開（E2Eテスト用）
if (import.meta.env.DEV) {
  (window as unknown as { __GRIDDER_GROUP_STORE__: typeof useGroupStore }).__GRIDDER_GROUP_STORE__ = useGroupStore;
}
