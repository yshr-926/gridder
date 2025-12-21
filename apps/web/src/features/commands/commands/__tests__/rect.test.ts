import { describe, it, expect, beforeEach } from 'vitest';
import { createRectCells, rectCommand } from '../rect';
import type { CommandContext } from '../../types';
import type { GridObject } from '@/types';

describe('createRectCells', () => {
  describe('filled rectangles', () => {
    it('should create a filled 3x3 rectangle', () => {
      const cells = createRectCells(0, 0, 2, 2, true);

      expect(cells).toHaveLength(9);
      expect(cells).toContainEqual([0, 0]);
      expect(cells).toContainEqual([1, 1]);
      expect(cells).toContainEqual([2, 2]);
    });

    it('should create a filled rectangle with reversed coordinates', () => {
      const cells = createRectCells(2, 2, 0, 0, true);

      expect(cells).toHaveLength(9);
      expect(cells).toContainEqual([0, 0]);
      expect(cells).toContainEqual([2, 2]);
    });

    it('should create a 1x1 rectangle', () => {
      const cells = createRectCells(0, 0, 0, 0, true);

      expect(cells).toHaveLength(1);
      expect(cells[0]).toEqual([0, 0]);
    });

    it('should create a wide rectangle', () => {
      const cells = createRectCells(0, 0, 4, 1, true);

      expect(cells).toHaveLength(10); // 5 x 2
    });

    it('should create a tall rectangle', () => {
      const cells = createRectCells(0, 0, 1, 4, true);

      expect(cells).toHaveLength(10); // 2 x 5
    });
  });

  describe('outline rectangles', () => {
    it('should create an outline 3x3 rectangle', () => {
      const cells = createRectCells(0, 0, 2, 2, false);

      // 3x3 の輪郭 = 8 セル（中央の1セルを除く）
      expect(cells).toHaveLength(8);
      expect(cells).toContainEqual([0, 0]);
      expect(cells).toContainEqual([2, 2]);
      expect(cells).not.toContainEqual([1, 1]); // 中央は含まない
    });

    it('should create an outline 5x5 rectangle', () => {
      const cells = createRectCells(0, 0, 4, 4, false);

      // 5x5 の輪郭 = 16 セル（周囲のみ）
      expect(cells).toHaveLength(16);
      expect(cells).not.toContainEqual([1, 1]);
      expect(cells).not.toContainEqual([2, 2]);
      expect(cells).not.toContainEqual([3, 3]);
    });

    it('should handle 1x1 outline (same as filled)', () => {
      const cells = createRectCells(0, 0, 0, 0, false);

      expect(cells).toHaveLength(1);
    });

    it('should handle 1-cell-wide outline', () => {
      const cells = createRectCells(0, 0, 4, 0, false);

      expect(cells).toHaveLength(5);
    });

    it('should handle 1-cell-tall outline', () => {
      const cells = createRectCells(0, 0, 0, 4, false);

      expect(cells).toHaveLength(5);
    });
  });

  describe('default behavior', () => {
    it('should default to filled', () => {
      const cells = createRectCells(0, 0, 2, 2);

      expect(cells).toHaveLength(9); // 3x3 filled
    });
  });
});

describe('rectCommand', () => {
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

  describe('filled rectangles', () => {
    it('should create a filled rectangle by default', () => {
      const result = rectCommand.execute(['0,0', '4,4'], mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('矩形を作成しました');
      expect(result.message).toContain('5x5');
      expect(result.message).toContain('塗りつぶし');
      expect(addedObjects).toHaveLength(1);
      expect(addedObjects[0].cells).toHaveLength(25); // 5x5
    });

    it('should create a filled rectangle with "filled" option', () => {
      const result = rectCommand.execute(['0,0', '2,2', 'filled'], mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('塗りつぶし');
      expect(addedObjects[0].cells).toHaveLength(9);
    });
  });

  describe('outline rectangles', () => {
    it('should create an outline rectangle', () => {
      const result = rectCommand.execute(['0,0', '4,4', 'outline'], mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('輪郭');
      expect(addedObjects[0].cells).toHaveLength(16); // 5x5 outline
    });
  });

  describe('position calculation', () => {
    it('should set correct position for rectangle', () => {
      rectCommand.execute(['5,10', '8,15'], mockContext);

      expect(addedObjects[0].position).toEqual({ x: 5, y: 10 });
    });

    it('should handle reversed coordinates', () => {
      rectCommand.execute(['10,15', '5,8'], mockContext);

      expect(addedObjects[0].position).toEqual({ x: 5, y: 8 });
    });
  });

  describe('error handling', () => {
    it('should return error for invalid first coordinate', () => {
      const result = rectCommand.execute(['invalid', '5,5'], mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toBe('無効な座標形式です');
      expect(addedObjects).toHaveLength(0);
    });

    it('should return error for invalid second coordinate', () => {
      const result = rectCommand.execute(['0,0', 'invalid'], mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toBe('無効な座標形式です');
    });
  });

  describe('object properties', () => {
    it('should create object with correct color', () => {
      rectCommand.execute(['0,0', '2,2'], mockContext);

      expect(addedObjects[0].color).toBe('#3b82f6');
    });

    it('should create object with rotation 0', () => {
      rectCommand.execute(['0,0', '2,2'], mockContext);

      expect(addedObjects[0].rotation).toBe(0);
    });

    it('should create object with unique id', () => {
      rectCommand.execute(['0,0', '2,2'], mockContext);

      expect(addedObjects[0].id).toMatch(/^obj-/);
    });
  });
});
