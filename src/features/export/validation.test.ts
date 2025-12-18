import { describe, it, expect } from 'vitest';
import {
  validateProjectData,
  validateGridObject,
  validateMetadata,
  isProjectData,
  isGridObject,
  isPosition,
  isCellCoordinate,
  ProjectValidationError,
} from './validation';
import { PROJECT_DATA_VERSION } from './types';
import type { ProjectData } from './types';

/**
 * 有効なプロジェクトデータのサンプル
 */
const createValidProjectData = (): ProjectData => ({
  version: PROJECT_DATA_VERSION,
  name: 'Test Project',
  gridSettings: {
    cellSize: 10,
    unit: 'cm',
  },
  objects: [
    {
      id: 'obj-1',
      cells: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      position: { x: 5, y: 10 },
      rotation: 0,
      color: '#333333',
      name: 'L字型オブジェクト',
    },
  ],
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z',
    exportedFrom: 'Gridder v1.0',
  },
});

describe('validation', () => {
  describe('validateProjectData', () => {
    it('should validate correct project data', () => {
      const data = createValidProjectData();
      const result = validateProjectData(data);
      expect(result).toEqual(data);
    });

    it('should throw error for non-object data', () => {
      expect(() => validateProjectData(null)).toThrow(ProjectValidationError);
      expect(() => validateProjectData('string')).toThrow(ProjectValidationError);
      expect(() => validateProjectData(123)).toThrow(ProjectValidationError);
    });

    it('should throw error for invalid version', () => {
      const data = { ...createValidProjectData(), version: '2.0' };
      expect(() => validateProjectData(data)).toThrow(ProjectValidationError);
    });

    it('should throw error for missing name', () => {
      const data = createValidProjectData();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (data as any).name;
      expect(() => validateProjectData(data)).toThrow(ProjectValidationError);
    });

    it('should throw error for invalid gridSettings', () => {
      const data = {
        ...createValidProjectData(),
        gridSettings: { cellSize: -1, unit: 'invalid' },
      };
      expect(() => validateProjectData(data)).toThrow(ProjectValidationError);
    });

    it('should throw error for non-array objects', () => {
      const data = { ...createValidProjectData(), objects: 'not an array' };
      expect(() => validateProjectData(data)).toThrow(ProjectValidationError);
    });

    it('should throw error for invalid objects in array', () => {
      const data = {
        ...createValidProjectData(),
        objects: [{ id: '', cells: [], position: { x: 0, y: 0 }, rotation: 45, color: '' }],
      };
      expect(() => validateProjectData(data)).toThrow(ProjectValidationError);
    });

    it('should include detailed error messages', () => {
      const data = {
        version: '2.0',
        name: 123,
        gridSettings: { cellSize: -1, unit: 'invalid' },
        objects: [],
        metadata: { createdAt: 'invalid', updatedAt: 'invalid', exportedFrom: '' },
      };
      try {
        validateProjectData(data);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProjectValidationError);
        const validationError = error as ProjectValidationError;
        expect(validationError.errors.length).toBeGreaterThan(0);
        expect(validationError.getDetailedMessage()).toContain('version');
      }
    });

    it('should validate empty objects array', () => {
      const data = { ...createValidProjectData(), objects: [] };
      const result = validateProjectData(data);
      expect(result.objects).toEqual([]);
    });
  });

  describe('validateGridObject', () => {
    it('should validate correct grid object', () => {
      const obj = {
        id: 'obj-1',
        cells: [[0, 0], [1, 0]],
        position: { x: 0, y: 0 },
        rotation: 90,
        color: '#ff0000',
      };
      const result = validateGridObject(obj, 'test');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for empty id', () => {
      const obj = {
        id: '',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#333',
      };
      const result = validateGridObject(obj, 'test');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('id'))).toBe(true);
    });

    it('should report error for invalid cells', () => {
      const obj = {
        id: 'obj-1',
        cells: [[0, 'invalid']],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#333',
      };
      const result = validateGridObject(obj, 'test');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('cells'))).toBe(true);
    });

    it('should report error for invalid rotation', () => {
      const obj = {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 45,
        color: '#333',
      };
      const result = validateGridObject(obj, 'test');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('rotation'))).toBe(true);
    });

    it('should allow optional name field', () => {
      const obj = {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#333',
        name: 'My Object',
      };
      const result = validateGridObject(obj, 'test');
      expect(result.valid).toBe(true);
    });

    it('should report error for non-string name', () => {
      const obj = {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#333',
        name: 123,
      };
      const result = validateGridObject(obj, 'test');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('name'))).toBe(true);
    });
  });

  describe('validateMetadata', () => {
    it('should validate correct metadata', () => {
      const metadata = {
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T12:00:00.000Z',
        exportedFrom: 'Gridder v1.0',
      };
      const result = validateMetadata(metadata, 'test');
      expect(result.valid).toBe(true);
    });

    it('should report error for invalid date strings', () => {
      const metadata = {
        createdAt: 'not a date',
        updatedAt: 'also not a date',
        exportedFrom: 'Gridder v1.0',
      };
      const result = validateMetadata(metadata, 'test');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('createdAt'))).toBe(true);
      expect(result.errors.some((e) => e.path.includes('updatedAt'))).toBe(true);
    });

    it('should report error for empty exportedFrom', () => {
      const metadata = {
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T12:00:00.000Z',
        exportedFrom: '',
      };
      const result = validateMetadata(metadata, 'test');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('exportedFrom'))).toBe(true);
    });
  });

  describe('isProjectData', () => {
    it('should return true for valid project data', () => {
      const data = createValidProjectData();
      expect(isProjectData(data)).toBe(true);
    });

    it('should return false for invalid project data', () => {
      expect(isProjectData(null)).toBe(false);
      expect(isProjectData({})).toBe(false);
      expect(isProjectData({ version: '2.0' })).toBe(false);
    });
  });

  describe('isGridObject', () => {
    it('should return true for valid grid object', () => {
      const obj = {
        id: 'obj-1',
        cells: [[0, 0]],
        position: { x: 0, y: 0 },
        rotation: 0,
        color: '#333',
      };
      expect(isGridObject(obj)).toBe(true);
    });

    it('should return false for invalid grid object', () => {
      expect(isGridObject(null)).toBe(false);
      expect(isGridObject({})).toBe(false);
      expect(isGridObject({ id: '' })).toBe(false);
    });
  });

  describe('isPosition', () => {
    it('should return true for valid position', () => {
      expect(isPosition({ x: 0, y: 0 })).toBe(true);
      expect(isPosition({ x: 10, y: -5 })).toBe(true);
      expect(isPosition({ x: 1.5, y: 2.5 })).toBe(true);
    });

    it('should return false for invalid position', () => {
      expect(isPosition(null)).toBe(false);
      expect(isPosition({})).toBe(false);
      expect(isPosition({ x: 0 })).toBe(false);
      expect(isPosition({ x: 'a', y: 0 })).toBe(false);
      expect(isPosition({ x: Infinity, y: 0 })).toBe(false);
    });
  });

  describe('isCellCoordinate', () => {
    it('should return true for valid cell coordinate', () => {
      expect(isCellCoordinate([0, 0])).toBe(true);
      expect(isCellCoordinate([10, -5])).toBe(true);
    });

    it('should return false for invalid cell coordinate', () => {
      expect(isCellCoordinate(null)).toBe(false);
      expect(isCellCoordinate([])).toBe(false);
      expect(isCellCoordinate([0])).toBe(false);
      expect(isCellCoordinate([0, 0, 0])).toBe(false);
      expect(isCellCoordinate([1.5, 0])).toBe(false);
      expect(isCellCoordinate(['a', 0])).toBe(false);
    });
  });

  describe('ProjectValidationError', () => {
    it('should create error with message', () => {
      const error = new ProjectValidationError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ProjectValidationError');
      expect(error.errors).toHaveLength(0);
    });

    it('should create error with error paths', () => {
      const errors = [
        { path: 'field1', message: 'Error 1' },
        { path: 'field2', message: 'Error 2' },
      ];
      const error = new ProjectValidationError('Test error', errors);
      expect(error.errors).toEqual(errors);
    });

    it('should generate detailed message', () => {
      const errors = [
        { path: 'field1', message: 'Error 1' },
        { path: 'field2', message: 'Error 2' },
      ];
      const error = new ProjectValidationError('Test error', errors);
      const detailed = error.getDetailedMessage();
      expect(detailed).toContain('Test error');
      expect(detailed).toContain('field1');
      expect(detailed).toContain('Error 1');
      expect(detailed).toContain('field2');
      expect(detailed).toContain('Error 2');
    });
  });
});
