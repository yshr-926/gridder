import { describe, it, expect, beforeEach } from 'vitest';
import { undoCommand } from '../undo';
import type { CommandContext } from '../../types';
import type { GridObject } from '@/types';

describe('undoCommand', () => {
  let mockContext: CommandContext;
  let currentObjects: GridObject[];

  beforeEach(() => {
    currentObjects = [
      {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#3b82f6',
      },
    ];
  });

  describe('when undo is available', () => {
    it('should undo the last operation', () => {
      const previousObjects: GridObject[] = [];
      let setObjectsCalled = false;
      let setObjectsArg: GridObject[] | null = null;

      mockContext = {
        canvasStore: {
          getState: () => ({
            objects: currentObjects,
            setObjects: (objs: GridObject[]) => {
              setObjectsCalled = true;
              setObjectsArg = objs;
            },
          }),
        } as unknown as CommandContext['canvasStore'],
        gridSettingsStore: {
          getState: () => ({}),
        } as unknown as CommandContext['gridSettingsStore'],
        historyStore: {
          getState: () => ({
            canUndo: () => true,
            undo: () => previousObjects,
          }),
        } as unknown as CommandContext['historyStore'],
        cursorPosition: null,
        lastPoint: null,
        getNextObjectColor: () => '#3b82f6',
      };

      const result = undoCommand.execute([], mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('操作を取り消しました');
      expect(setObjectsCalled).toBe(true);
      expect(setObjectsArg).toEqual(previousObjects);
    });

    it('should restore previous state', () => {
      const previousObjects: GridObject[] = [
        {
          id: 'old-obj',
          cells: [[0, 0], [1, 0]],
          position: { x: 5, y: 5 },
          rotation: 0,
          color: '#ef4444',
        },
      ];
      let restoredObjects: GridObject[] | null = null;

      mockContext = {
        canvasStore: {
          getState: () => ({
            objects: currentObjects,
            setObjects: (objs: GridObject[]) => {
              restoredObjects = objs;
            },
          }),
        } as unknown as CommandContext['canvasStore'],
        gridSettingsStore: {
          getState: () => ({}),
        } as unknown as CommandContext['gridSettingsStore'],
        historyStore: {
          getState: () => ({
            canUndo: () => true,
            undo: () => previousObjects,
          }),
        } as unknown as CommandContext['historyStore'],
        cursorPosition: null,
        lastPoint: null,
        getNextObjectColor: () => '#3b82f6',
      };

      undoCommand.execute([], mockContext);

      expect(restoredObjects).toEqual(previousObjects);
    });
  });

  describe('when undo is not available', () => {
    it('should return error when canUndo returns false', () => {
      mockContext = {
        canvasStore: {
          getState: () => ({
            objects: currentObjects,
            setObjects: () => {},
          }),
        } as unknown as CommandContext['canvasStore'],
        gridSettingsStore: {
          getState: () => ({}),
        } as unknown as CommandContext['gridSettingsStore'],
        historyStore: {
          getState: () => ({
            canUndo: () => false,
            undo: () => null,
          }),
        } as unknown as CommandContext['historyStore'],
        cursorPosition: null,
        lastPoint: null,
        getNextObjectColor: () => '#3b82f6',
      };

      const result = undoCommand.execute([], mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toBe('取り消す操作がありません');
    });

    it('should return error when undo returns null', () => {
      mockContext = {
        canvasStore: {
          getState: () => ({
            objects: currentObjects,
            setObjects: () => {},
          }),
        } as unknown as CommandContext['canvasStore'],
        gridSettingsStore: {
          getState: () => ({}),
        } as unknown as CommandContext['gridSettingsStore'],
        historyStore: {
          getState: () => ({
            canUndo: () => true,
            undo: () => null, // undo returns null
          }),
        } as unknown as CommandContext['historyStore'],
        cursorPosition: null,
        lastPoint: null,
        getNextObjectColor: () => '#3b82f6',
      };

      const result = undoCommand.execute([], mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toBe('取り消す操作がありません');
    });
  });

  describe('command properties', () => {
    it('should have correct name', () => {
      expect(undoCommand.name).toBe('UNDO');
    });

    it('should have correct aliases', () => {
      expect(undoCommand.aliases).toContain('U');
    });

    it('should require no arguments', () => {
      expect(undoCommand.requiredArgs).toBe(0);
      expect(undoCommand.optionalArgs).toBe(0);
    });
  });
});
