import { describe, it, expect, beforeEach } from 'vitest';
import { drawLine, lineCommand } from '../line';
import type { CommandContext } from '../../types';
import type { GridObject } from '@/types';

describe('drawLine', () => {
  describe('horizontal lines', () => {
    it('should draw a horizontal line from left to right', () => {
      const cells = drawLine(0, 0, 5, 0);

      expect(cells).toHaveLength(6);
      expect(cells).toContainEqual([0, 0]);
      expect(cells).toContainEqual([1, 0]);
      expect(cells).toContainEqual([2, 0]);
      expect(cells).toContainEqual([3, 0]);
      expect(cells).toContainEqual([4, 0]);
      expect(cells).toContainEqual([5, 0]);
    });

    it('should draw a horizontal line from right to left', () => {
      const cells = drawLine(5, 0, 0, 0);

      expect(cells).toHaveLength(6);
      expect(cells[0]).toEqual([5, 0]);
      expect(cells[5]).toEqual([0, 0]);
    });
  });

  describe('vertical lines', () => {
    it('should draw a vertical line from top to bottom', () => {
      const cells = drawLine(0, 0, 0, 5);

      expect(cells).toHaveLength(6);
      expect(cells).toContainEqual([0, 0]);
      expect(cells).toContainEqual([0, 1]);
      expect(cells).toContainEqual([0, 2]);
      expect(cells).toContainEqual([0, 3]);
      expect(cells).toContainEqual([0, 4]);
      expect(cells).toContainEqual([0, 5]);
    });

    it('should draw a vertical line from bottom to top', () => {
      const cells = drawLine(0, 5, 0, 0);

      expect(cells).toHaveLength(6);
      expect(cells[0]).toEqual([0, 5]);
      expect(cells[5]).toEqual([0, 0]);
    });
  });

  describe('diagonal lines', () => {
    it('should draw a 45-degree diagonal line', () => {
      const cells = drawLine(0, 0, 5, 5);

      expect(cells).toHaveLength(6);
      expect(cells).toContainEqual([0, 0]);
      expect(cells).toContainEqual([1, 1]);
      expect(cells).toContainEqual([2, 2]);
      expect(cells).toContainEqual([3, 3]);
      expect(cells).toContainEqual([4, 4]);
      expect(cells).toContainEqual([5, 5]);
    });

    it('should draw a steep diagonal line', () => {
      const cells = drawLine(0, 0, 2, 6);

      expect(cells).toHaveLength(7);
      expect(cells[0]).toEqual([0, 0]);
      expect(cells[cells.length - 1]).toEqual([2, 6]);
    });

    it('should draw a shallow diagonal line', () => {
      const cells = drawLine(0, 0, 6, 2);

      expect(cells).toHaveLength(7);
      expect(cells[0]).toEqual([0, 0]);
      expect(cells[cells.length - 1]).toEqual([6, 2]);
    });
  });

  describe('single point', () => {
    it('should handle same start and end point', () => {
      const cells = drawLine(5, 5, 5, 5);

      expect(cells).toHaveLength(1);
      expect(cells[0]).toEqual([5, 5]);
    });
  });

  describe('negative coordinates', () => {
    it('should handle negative coordinates', () => {
      const cells = drawLine(-2, -2, 2, 2);

      expect(cells).toHaveLength(5);
      expect(cells).toContainEqual([-2, -2]);
      expect(cells).toContainEqual([2, 2]);
    });
  });
});

describe('lineCommand', () => {
  let mockContext: CommandContext;
  let addedObjects: GridObject[];

  beforeEach(() => {
    addedObjects = [];
    mockContext = {
      canvasStore: {
        getState: () => ({
          addObject: (obj: GridObject) => {
            addedObjects.push(obj);
          },
          objects: [],
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
  });

  describe('with two arguments', () => {
    it('should create a line object from two coordinates', () => {
      const result = lineCommand.execute(['0,0', '5,0'], mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('線を作成しました');
      expect(result.createdObjectId).toBeDefined();
      expect(addedObjects).toHaveLength(1);
      expect(addedObjects[0].cells).toHaveLength(6);
    });

    it('should handle relative coordinate for second point', () => {
      mockContext.lastPoint = { x: 0, y: 0 };

      const result = lineCommand.execute(['0,0', '@5,0'], mockContext);

      expect(result.success).toBe(true);
      expect(addedObjects).toHaveLength(1);
    });

    it('should return error for invalid coordinates', () => {
      const result = lineCommand.execute(['invalid', '5,0'], mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toBe('無効な座標形式です');
      expect(addedObjects).toHaveLength(0);
    });
  });

  describe('with no arguments (interactive mode)', () => {
    it('should return prompt for start point', () => {
      const result = lineCommand.execute([], mockContext);

      expect(result.success).toBe(true);
      expect(result.prompt).toContain('始点');
    });
  });

  describe('with one argument', () => {
    it('should return prompt for end point', () => {
      const result = lineCommand.execute(['0,0'], mockContext);

      expect(result.success).toBe(true);
      expect(result.prompt).toContain('終点');
      expect(result.stateUpdate?.lastPoint).toEqual({ x: 0, y: 0 });
    });
  });

  describe('state update', () => {
    it('should update lastPoint after creating line', () => {
      const result = lineCommand.execute(['0,0', '5,5'], mockContext);

      expect(result.stateUpdate?.lastPoint).toEqual({ x: 5, y: 5 });
    });
  });
});
