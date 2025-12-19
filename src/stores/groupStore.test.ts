import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useGroupStore } from './groupStore';
import { useCanvasStore } from './canvasStore';

// Mock canvasStore
vi.mock('./canvasStore', () => ({
  useCanvasStore: {
    getState: vi.fn(() => ({
      selectObjects: vi.fn(),
    })),
  },
}));

describe('useGroupStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useGroupStore.getState().clearGroups();
    });
    vi.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create a group with 2 or more objects', () => {
      const objectIds = ['obj-1', 'obj-2', 'obj-3'];

      act(() => {
        useGroupStore.getState().createGroup(objectIds, 'Test Group');
      });

      const groups = useGroupStore.getState().groups;
      expect(groups).toHaveLength(1);

      const group = groups[0];
      expect(group.objectIds).toEqual(objectIds);
      expect(group.name).toBe('Test Group');
      expect(group.anchorObjectId).toBe('obj-1');
      expect(group.createdAt).toBeDefined();
    });

    it('should return null when less than 2 objects', () => {
      let result;
      act(() => {
        result = useGroupStore.getState().createGroup(['obj-1']);
      });

      expect(result).toBeNull();
      expect(useGroupStore.getState().groups).toHaveLength(0);
    });

    it('should return null when empty array', () => {
      let result;
      act(() => {
        result = useGroupStore.getState().createGroup([]);
      });

      expect(result).toBeNull();
      expect(useGroupStore.getState().groups).toHaveLength(0);
    });

    it('should create group without name', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2']);
      });

      const groups = useGroupStore.getState().groups;
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBeUndefined();
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group by id', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2']);
      });

      expect(useGroupStore.getState().groups).toHaveLength(1);
      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().deleteGroup(groupId);
      });

      expect(useGroupStore.getState().groups).toHaveLength(0);
    });

    it('should not affect other groups when deleting', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2'], 'Group 1');
        useGroupStore.getState().createGroup(['obj-3', 'obj-4'], 'Group 2');
      });

      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().deleteGroup(groupId);
      });

      expect(useGroupStore.getState().groups).toHaveLength(1);
      expect(useGroupStore.getState().groups[0].name).toBe('Group 2');
    });
  });

  describe('addToGroup', () => {
    it('should add an object to a group', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2']);
      });

      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().addToGroup(groupId, 'obj-3');
      });

      const updatedGroup = useGroupStore.getState().groups[0];
      expect(updatedGroup.objectIds).toContain('obj-3');
      expect(updatedGroup.objectIds).toHaveLength(3);
    });

    it('should not add duplicate object to group', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2']);
      });

      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().addToGroup(groupId, 'obj-1');
      });

      const updatedGroup = useGroupStore.getState().groups[0];
      expect(updatedGroup.objectIds).toHaveLength(2);
    });
  });

  describe('removeFromGroup', () => {
    it('should remove an object from a group', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2', 'obj-3']);
      });

      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().removeFromGroup(groupId, 'obj-2');
      });

      const updatedGroup = useGroupStore.getState().groups[0];
      expect(updatedGroup.objectIds).not.toContain('obj-2');
      expect(updatedGroup.objectIds).toHaveLength(2);
    });

    it('should auto-delete group when members become 1 or less', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2']);
      });

      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().removeFromGroup(groupId, 'obj-2');
      });

      expect(useGroupStore.getState().groups).toHaveLength(0);
    });

    it('should update anchor when anchor is removed', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2', 'obj-3']);
      });

      const groupId = useGroupStore.getState().groups[0].id;
      expect(useGroupStore.getState().groups[0].anchorObjectId).toBe('obj-1');

      act(() => {
        useGroupStore.getState().removeFromGroup(groupId, 'obj-1');
      });

      const updatedGroup = useGroupStore.getState().groups[0];
      expect(updatedGroup.anchorObjectId).toBe('obj-2');
    });

    it('should not change anchor when non-anchor is removed', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2', 'obj-3']);
      });

      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().removeFromGroup(groupId, 'obj-3');
      });

      const updatedGroup = useGroupStore.getState().groups[0];
      expect(updatedGroup.anchorObjectId).toBe('obj-1');
    });
  });

  describe('renameGroup', () => {
    it('should rename a group', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2'], 'Old Name');
      });

      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().renameGroup(groupId, 'New Name');
      });

      expect(useGroupStore.getState().groups[0].name).toBe('New Name');
    });
  });

  describe('getGroupByObjectId', () => {
    it('should return group containing the object', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2'], 'Group A');
        useGroupStore.getState().createGroup(['obj-3', 'obj-4'], 'Group B');
      });

      const group = useGroupStore.getState().getGroupByObjectId('obj-3');
      expect(group?.name).toBe('Group B');
    });

    it('should return null when object is not in any group', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2']);
      });

      const group = useGroupStore.getState().getGroupByObjectId('obj-5');
      expect(group).toBeNull();
    });
  });

  describe('getObjectsInGroup', () => {
    it('should return object ids in a group', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2', 'obj-3']);
      });

      const groupId = useGroupStore.getState().groups[0].id;
      const objectIds = useGroupStore.getState().getObjectsInGroup(groupId);
      expect(objectIds).toEqual(['obj-1', 'obj-2', 'obj-3']);
    });

    it('should return empty array for non-existent group', () => {
      const objectIds = useGroupStore.getState().getObjectsInGroup('non-existent');
      expect(objectIds).toEqual([]);
    });
  });

  describe('selectGroup', () => {
    it('should call selectObjects with group object ids', () => {
      const mockSelectObjects = vi.fn();
      (useCanvasStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
        selectObjects: mockSelectObjects,
      });

      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2', 'obj-3']);
      });

      const groupId = useGroupStore.getState().groups[0].id;

      act(() => {
        useGroupStore.getState().selectGroup(groupId);
      });

      expect(mockSelectObjects).toHaveBeenCalledWith(['obj-1', 'obj-2', 'obj-3']);
    });

    it('should not call selectObjects for non-existent group', () => {
      const mockSelectObjects = vi.fn();
      (useCanvasStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
        selectObjects: mockSelectObjects,
      });

      act(() => {
        useGroupStore.getState().selectGroup('non-existent');
      });

      expect(mockSelectObjects).not.toHaveBeenCalled();
    });
  });

  describe('setGroups', () => {
    it('should set groups', () => {
      const groups = [
        {
          id: 'group-1',
          objectIds: ['obj-1', 'obj-2'],
          anchorObjectId: 'obj-1',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'group-2',
          objectIds: ['obj-3', 'obj-4'],
          anchorObjectId: 'obj-3',
          name: 'Group 2',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];

      act(() => {
        useGroupStore.getState().setGroups(groups);
      });

      expect(useGroupStore.getState().groups).toEqual(groups);
    });
  });

  describe('clearGroups', () => {
    it('should clear all groups', () => {
      act(() => {
        useGroupStore.getState().createGroup(['obj-1', 'obj-2']);
        useGroupStore.getState().createGroup(['obj-3', 'obj-4']);
      });

      expect(useGroupStore.getState().groups).toHaveLength(2);

      act(() => {
        useGroupStore.getState().clearGroups();
      });

      expect(useGroupStore.getState().groups).toHaveLength(0);
    });
  });
});
