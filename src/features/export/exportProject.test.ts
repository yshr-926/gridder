import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateFilename,
  createProjectData,
  serializeProjectData,
  exportProjectAsJSON,
} from './exportProject';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useGroupStore } from '@/stores/groupStore';
import { PROJECT_DATA_VERSION } from './types';

// Store のリセット用
const resetStores = () => {
  useCanvasStore.setState({
    objects: [],
    selectedObjectId: null,
    drawingCells: [],
    toolMode: 'draw',
    panPosition: { x: 0, y: 0 },
  });
  useGridSettingsStore.setState({
    cellSize: 10,
    unit: 'cm',
    zoom: 1,
  });
  useGroupStore.setState({
    groups: [],
  });
};

describe('exportProject', () => {
  beforeEach(() => {
    resetStores();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateFilename', () => {
    it('should generate filename with timestamp', () => {
      vi.setSystemTime(new Date('2024-12-18T14:30:25.000Z'));
      const filename = generateFilename('gridder-project', 'json');
      expect(filename).toBe('gridder-project_20241218_143025.json');
    });

    it('should use default prefix and extension', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      const filename = generateFilename();
      expect(filename).toBe('gridder-project_20240101_000000.json');
    });

    it('should handle different extensions', () => {
      vi.setSystemTime(new Date('2024-06-15T09:05:30.000Z'));
      const filename = generateFilename('test', 'png');
      expect(filename).toBe('test_20240615_090530.png');
    });
  });

  describe('createProjectData', () => {
    it('should create project data from store state', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));

      // Store にデータを設定
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0], [1, 0]],
            position: { x: 5, y: 10 },
            rotation: 90,
            color: '#ff0000',
            name: 'Test Object',
          },
        ],
      });
      useGridSettingsStore.setState({
        cellSize: 20,
        unit: 'mm',
      });

      const data = createProjectData('My Project');

      expect(data.version).toBe(PROJECT_DATA_VERSION);
      expect(data.name).toBe('My Project');
      expect(data.gridSettings).toEqual({
        cellSize: 20,
        unit: 'mm',
      });
      expect(data.objects).toHaveLength(1);
      expect(data.objects[0].id).toBe('obj-1');
      expect(data.objects[0].cells).toEqual([[0, 0], [1, 0]]);
      expect(data.metadata.createdAt).toBe('2024-01-01T12:00:00.000Z');
      expect(data.metadata.updatedAt).toBe('2024-01-01T12:00:00.000Z');
      expect(data.metadata.exportedFrom).toContain('Gridder');
    });

    it('should deep copy objects', () => {
      const originalCells: [number, number][] = [[0, 0], [1, 0]];
      const originalPosition = { x: 5, y: 10 };

      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: originalCells,
            position: originalPosition,
            rotation: 0,
            color: '#333',
          },
        ],
      });

      const data = createProjectData();

      // 元の配列を変更してもプロジェクトデータに影響しないことを確認
      originalCells[0][0] = 999;
      originalPosition.x = 999;

      expect(data.objects[0].cells[0][0]).toBe(0);
      expect(data.objects[0].position.x).toBe(5);
    });

    it('should handle empty project name', () => {
      const data = createProjectData();
      expect(data.name).toBe('');
    });

    it('should handle empty objects array', () => {
      const data = createProjectData('Empty Project');
      expect(data.objects).toEqual([]);
    });
  });

  describe('serializeProjectData', () => {
    it('should serialize with pretty print by default', () => {
      const data = createProjectData('Test');
      const json = serializeProjectData(data);

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('should serialize without pretty print when specified', () => {
      const data = createProjectData('Test');
      const json = serializeProjectData(data, false);

      expect(json).not.toContain('\n  ');
    });

    it('should produce valid JSON', () => {
      const data = createProjectData('Test');
      const json = serializeProjectData(data);

      expect(() => JSON.parse(json)).not.toThrow();
      expect(JSON.parse(json)).toEqual(data);
    });
  });

  describe('exportProjectAsJSON', () => {
    it('should create and download blob', () => {
      // DOM操作のモック
      const mockClick = vi.fn();
      const mockLink = document.createElement('a');
      mockLink.click = mockClick;

      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);

      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
      const mockRevokeObjectURL = vi.fn();
      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      });

      vi.setSystemTime(new Date('2024-12-18T14:30:25.000Z'));

      exportProjectAsJSON({ projectName: 'Test Project' });

      expect(mockClick).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });

    it('should use custom filename when provided', () => {
      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };

      vi.spyOn(document, 'createElement').mockReturnValue(
        mockLink as unknown as HTMLAnchorElement
      );
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn().mockReturnValue('blob:test-url'),
        revokeObjectURL: vi.fn(),
      });

      exportProjectAsJSON({ filename: 'custom-name.json' });

      expect(mockLink.download).toBe('custom-name.json');
    });
  });

  describe('Group Export', () => {
    it('should include groups in project data when groups exist', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));

      // Setup objects
      useCanvasStore.setState({
        objects: [
          { id: 'obj-1', cells: [[0, 0]], position: { x: 0, y: 0 }, rotation: 0, color: '#ff0000' },
          { id: 'obj-2', cells: [[1, 0]], position: { x: 1, y: 0 }, rotation: 0, color: '#00ff00' },
        ],
      });

      // Setup groups
      useGroupStore.setState({
        groups: [
          {
            id: 'group-1',
            objectIds: ['obj-1', 'obj-2'],
            anchorObjectId: 'obj-1',
            name: 'Test Group',
            createdAt: '2024-01-01T10:00:00.000Z',
          },
        ],
      });

      const data = createProjectData('Group Test');

      expect(data.groups).toBeDefined();
      expect(data.groups).toHaveLength(1);
      expect(data.groups![0].id).toBe('group-1');
      expect(data.groups![0].objectIds).toEqual(['obj-1', 'obj-2']);
      expect(data.groups![0].name).toBe('Test Group');
    });

    it('should not include groups field when no groups exist', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));

      useCanvasStore.setState({
        objects: [
          { id: 'obj-1', cells: [[0, 0]], position: { x: 0, y: 0 }, rotation: 0, color: '#ff0000' },
        ],
      });

      // No groups
      useGroupStore.setState({ groups: [] });

      const data = createProjectData('No Groups');

      expect(data.groups).toBeUndefined();
    });

    it('should deep copy groups', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));

      const originalGroup = {
        id: 'group-1',
        objectIds: ['obj-1', 'obj-2'],
        anchorObjectId: 'obj-1',
        createdAt: '2024-01-01T10:00:00.000Z',
      };

      useCanvasStore.setState({
        objects: [
          { id: 'obj-1', cells: [[0, 0]], position: { x: 0, y: 0 }, rotation: 0, color: '#ff0000' },
          { id: 'obj-2', cells: [[1, 0]], position: { x: 1, y: 0 }, rotation: 0, color: '#00ff00' },
        ],
      });

      useGroupStore.setState({
        groups: [originalGroup],
      });

      const data = createProjectData('Copy Test');

      // Modify original
      originalGroup.objectIds.push('obj-3');

      // Exported data should not be affected
      expect(data.groups![0].objectIds).toEqual(['obj-1', 'obj-2']);
    });
  });
});
