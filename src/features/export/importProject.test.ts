import { describe, it, expect, beforeEach } from 'vitest';
import {
  importProjectFromJSON,
  importProjectFromFile,
  applyProjectData,
  createNewProject,
  hasUnsavedChanges,
} from './importProject';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useHistoryStore } from '@/stores/historyStore';
import { PROJECT_DATA_VERSION } from './types';
import type { ProjectData } from './types';

/**
 * 有効なプロジェクトデータのサンプル
 */
const createValidProjectData = (): ProjectData => ({
  version: PROJECT_DATA_VERSION,
  name: 'Test Project',
  gridSettings: {
    cellSize: 20,
    unit: 'mm',
  },
  objects: [
    {
      id: 'obj-1',
      cells: [[0, 0], [1, 0], [1, 1]],
      position: { x: 5, y: 10 },
      rotation: 90,
      color: '#ff0000',
      name: 'L字型',
    },
  ],
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z',
    exportedFrom: 'Gridder v1.0',
  },
});

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
  useHistoryStore.getState().clearHistory();
};

describe('importProject', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('importProjectFromJSON', () => {
    it('should import valid JSON string', () => {
      const data = createValidProjectData();
      const json = JSON.stringify(data);
      const result = importProjectFromJSON(json);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid JSON syntax', () => {
      const result = importProjectFromJSON('{ invalid json }');

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
      expect(result.data).toBeUndefined();
    });

    it('should return error for invalid project data', () => {
      const invalidData = { version: '2.0', name: 'Test' };
      const json = JSON.stringify(invalidData);
      const result = importProjectFromJSON(json);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it('should return error for empty JSON', () => {
      const result = importProjectFromJSON('{}');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('importProjectFromFile', () => {
    it('should import valid JSON file', async () => {
      const data = createValidProjectData();
      const json = JSON.stringify(data);
      const file = new File([json], 'test.json', { type: 'application/json' });

      const result = await importProjectFromFile(file);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should return error for non-JSON file', async () => {
      const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

      const result = await importProjectFromFile(file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });

    it('should return error for invalid JSON content', async () => {
      const file = new File(['not json'], 'test.json', { type: 'application/json' });

      const result = await importProjectFromFile(file);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle uppercase extension', async () => {
      const data = createValidProjectData();
      const json = JSON.stringify(data);
      const file = new File([json], 'test.JSON', { type: 'application/json' });

      const result = await importProjectFromFile(file);

      expect(result.success).toBe(true);
    });
  });

  describe('applyProjectData', () => {
    it('should apply project data to stores', () => {
      const data = createValidProjectData();
      applyProjectData(data);

      const canvasState = useCanvasStore.getState();
      const gridState = useGridSettingsStore.getState();

      expect(gridState.cellSize).toBe(20);
      expect(gridState.unit).toBe('mm');
      expect(canvasState.objects).toHaveLength(1);
      expect(canvasState.objects[0].id).toBe('obj-1');
      expect(canvasState.selectedObjectId).toBeNull();
      expect(canvasState.toolMode).toBe('draw');
    });

    it('should deep copy objects', () => {
      const data = createValidProjectData();
      applyProjectData(data);

      const canvasState = useCanvasStore.getState();

      // 元のデータを変更
      data.objects[0].cells[0][0] = 999;
      data.objects[0].position.x = 999;

      // ストアのデータは変更されていないはず
      expect(canvasState.objects[0].cells[0][0]).toBe(0);
      expect(canvasState.objects[0].position.x).toBe(5);
    });

    it('should clear history', () => {
      // 履歴を追加
      useHistoryStore.getState().pushState([]);
      expect(useHistoryStore.getState().canUndo()).toBe(true);

      // プロジェクトデータを適用
      applyProjectData(createValidProjectData());

      // 履歴がクリアされているはず
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });

    it('should clear drawing cells and selection', () => {
      // 描画中データと選択状態を設定
      useCanvasStore.setState({
        drawingCells: [[0, 0], [1, 0]],
        selectedObjectId: 'some-id',
      });

      applyProjectData(createValidProjectData());

      const canvasState = useCanvasStore.getState();
      expect(canvasState.drawingCells).toEqual([]);
      expect(canvasState.selectedObjectId).toBeNull();
    });
  });

  describe('createNewProject', () => {
    it('should reset all stores to default values', () => {
      // 状態を変更
      useCanvasStore.setState({
        objects: [{ id: '1', cells: [[0, 0]], position: { x: 0, y: 0 }, rotation: 0, color: '#333' }],
        selectedObjectId: '1',
        drawingCells: [[0, 0]],
        toolMode: 'select',
        panPosition: { x: 100, y: 100 },
      });
      useGridSettingsStore.setState({
        cellSize: 50,
        unit: 'm',
        zoom: 2,
      });
      useHistoryStore.getState().pushState([]);

      // 新規プロジェクト作成
      createNewProject();

      const canvasState = useCanvasStore.getState();
      const gridState = useGridSettingsStore.getState();

      expect(canvasState.objects).toEqual([]);
      expect(canvasState.selectedObjectId).toBeNull();
      expect(canvasState.drawingCells).toEqual([]);
      expect(canvasState.toolMode).toBe('draw');
      expect(canvasState.panPosition).toEqual({ x: 0, y: 0 });
      expect(gridState.cellSize).toBe(10);
      expect(gridState.unit).toBe('cm');
      expect(gridState.zoom).toBe(1);
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });
  });

  describe('hasUnsavedChanges', () => {
    it('should return false for empty project', () => {
      expect(hasUnsavedChanges()).toBe(false);
    });

    it('should return true when objects exist', () => {
      useCanvasStore.setState({
        objects: [
          { id: '1', cells: [[0, 0]], position: { x: 0, y: 0 }, rotation: 0, color: '#333' },
        ],
      });

      expect(hasUnsavedChanges()).toBe(true);
    });
  });
});
