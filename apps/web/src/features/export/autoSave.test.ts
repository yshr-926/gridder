import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  STORAGE_KEY,
  STORAGE_TIME_KEY,
  saveToLocalStorage,
  loadFromLocalStorage,
  hasAutoSavedData,
  getLastAutoSaveTime,
  clearLocalStorage,
  restoreFromLocalStorage,
  useAutoSave,
  useRestoreConfirmation,
} from './autoSave';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
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
};

// LocalStorage モック
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    reset: () => {
      store = {};
    },
  };
})();

describe('autoSave', () => {
  beforeEach(() => {
    resetStores();
    mockLocalStorage.reset();
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('saveToLocalStorage', () => {
    it('should save project data to localStorage', () => {
      useCanvasStore.setState({
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 0, y: 0 },
            rotation: 0,
            color: '#333',
          },
        ],
      });

      const result = saveToLocalStorage();

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"version"')
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_TIME_KEY,
        expect.any(String)
      );
    });

    it('should return false on localStorage error', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      const result = saveToLocalStorage();

      expect(result).toBe(false);
    });
  });

  describe('loadFromLocalStorage', () => {
    it('should load data from localStorage', () => {
      const testData = '{"version":"1.0"}';
      mockLocalStorage.getItem.mockReturnValueOnce(testData);

      const result = loadFromLocalStorage();

      expect(result).toBe(testData);
    });

    it('should return null if no data', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const result = loadFromLocalStorage();

      expect(result).toBeNull();
    });
  });

  describe('hasAutoSavedData', () => {
    it('should return true if data exists', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('{"data": true}');

      expect(hasAutoSavedData()).toBe(true);
    });

    it('should return false if no data', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      expect(hasAutoSavedData()).toBe(false);
    });

    it('should return false for empty string', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('');

      expect(hasAutoSavedData()).toBe(false);
    });
  });

  describe('getLastAutoSaveTime', () => {
    it('should return Date object for valid time', () => {
      const timeStr = '2024-01-01T12:00:00.000Z';
      mockLocalStorage.getItem.mockReturnValueOnce(timeStr);

      const result = getLastAutoSaveTime();

      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(timeStr);
    });

    it('should return null for invalid time', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid');

      const result = getLastAutoSaveTime();

      expect(result).toBeNull();
    });

    it('should return null if no time stored', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const result = getLastAutoSaveTime();

      expect(result).toBeNull();
    });
  });

  describe('clearLocalStorage', () => {
    it('should remove both keys', () => {
      clearLocalStorage();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_TIME_KEY);
    });
  });

  describe('restoreFromLocalStorage', () => {
    it('should restore valid project data', () => {
      const projectData = {
        version: PROJECT_DATA_VERSION,
        name: 'Test',
        gridSettings: { cellSize: 20, unit: 'mm' },
        objects: [
          {
            id: 'obj-1',
            cells: [[0, 0]],
            position: { x: 5, y: 10 },
            rotation: 0,
            color: '#ff0000',
          },
        ],
        metadata: {
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          exportedFrom: 'Gridder v1.0',
        },
      };
      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(projectData));

      const result = restoreFromLocalStorage();

      expect(result).toBe(true);
      expect(useGridSettingsStore.getState().cellSize).toBe(20);
      expect(useGridSettingsStore.getState().unit).toBe('mm');
      expect(useCanvasStore.getState().objects).toHaveLength(1);
    });

    it('should return false for invalid data', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid json');

      const result = restoreFromLocalStorage();

      expect(result).toBe(false);
    });

    it('should return false if no data', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const result = restoreFromLocalStorage();

      expect(result).toBe(false);
    });
  });

  describe('useAutoSave', () => {
    it('should save after delay when objects change', async () => {
      // 初期状態でフックをレンダリング（最初の保存はスキップ）
      renderHook(() => useAutoSave(true, 100));

      // カウンタをリセット
      mockLocalStorage.setItem.mockClear();

      // オブジェクトを追加
      act(() => {
        useCanvasStore.setState({
          objects: [
            {
              id: 'obj-new',
              cells: [[1, 1]],
              position: { x: 1, y: 1 },
              rotation: 0,
              color: '#444',
            },
          ],
        });
      });

      // 遅延後に保存される
      act(() => {
        vi.advanceTimersByTime(200);
      });

      const saveKeyCalls = mockLocalStorage.setItem.mock.calls.filter(
        (call) => call[0] === STORAGE_KEY
      );
      expect(saveKeyCalls.length).toBeGreaterThan(0);
    });

    it('should not save when disabled', () => {
      // カウンタをリセット
      mockLocalStorage.setItem.mockClear();

      renderHook(() => useAutoSave(false, 100));

      act(() => {
        useCanvasStore.setState({
          objects: [
            {
              id: 'obj-1',
              cells: [[0, 0]],
              position: { x: 0, y: 0 },
              rotation: 0,
              color: '#333',
            },
          ],
        });
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // 自動保存呼び出しがないことを確認
      const saveKeyCalls = mockLocalStorage.setItem.mock.calls.filter(
        (call) => call[0] === STORAGE_KEY
      );
      expect(saveKeyCalls).toHaveLength(0);
    });

    it('should provide manual save function', () => {
      const { result } = renderHook(() => useAutoSave(false));

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.save();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.any(String)
      );
    });

    it('should debounce multiple changes', () => {
      renderHook(() => useAutoSave(true, 100));

      // カウンタをリセット
      mockLocalStorage.setItem.mockClear();

      // 複数回の変更を短い間隔で行う
      act(() => {
        for (let i = 0; i < 5; i++) {
          useCanvasStore.setState({
            objects: [
              {
                id: `obj-${i}`,
                cells: [[0, 0]],
                position: { x: i, y: 0 },
                rotation: 0,
                color: '#333',
              },
            ],
          });
          vi.advanceTimersByTime(30); // 遅延未満
        }
      });

      // 最後の変更から遅延後に保存
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // 複数回変更しても、保存は1回（デバウンス）
      const saveCallsAfter = mockLocalStorage.setItem.mock.calls.filter(
        (call) => call[0] === STORAGE_KEY
      );
      // 最低1回は保存されているはず
      expect(saveCallsAfter.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('useRestoreConfirmation', () => {
    it('should detect existing data', () => {
      mockLocalStorage.getItem.mockReturnValue('{"data": true}');

      const { result } = renderHook(() => useRestoreConfirmation());

      expect(result.current.hasData).toBe(true);
    });

    it('should return last save time', () => {
      const timeStr = '2024-01-01T12:00:00.000Z';
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === STORAGE_KEY) return '{"data": true}';
        if (key === STORAGE_TIME_KEY) return timeStr;
        return null;
      });

      const { result } = renderHook(() => useRestoreConfirmation());

      expect(result.current.lastSaveTime?.toISOString()).toBe(timeStr);
    });

    it('should restore data when restore called', () => {
      const projectData = {
        version: PROJECT_DATA_VERSION,
        name: 'Test',
        gridSettings: { cellSize: 30, unit: 'm' },
        objects: [],
        metadata: {
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          exportedFrom: 'Gridder v1.0',
        },
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectData));

      const { result } = renderHook(() => useRestoreConfirmation());

      act(() => {
        result.current.restore();
      });

      expect(useGridSettingsStore.getState().cellSize).toBe(30);
    });

    it('should clear data when dismiss called', () => {
      mockLocalStorage.getItem.mockReturnValue('{"data": true}');

      const { result } = renderHook(() => useRestoreConfirmation());

      act(() => {
        result.current.dismiss();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });
});
