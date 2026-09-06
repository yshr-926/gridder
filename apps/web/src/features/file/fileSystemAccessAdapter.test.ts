import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileSystemAccessAdapter } from './fileSystemAccessAdapter';

/**
 * Mocks `window.showSaveFilePicker` / `showOpenFilePicker` (issue #54): the
 * real File System Access API only exists in Chromium and is not present in
 * jsdom, so every test here drives a hand-built fake handle instead of the
 * browser.
 */

const createMockHandle = (name: string, initialContent = '') => {
  let content = initialContent;
  const write = vi.fn(async (data: string) => {
    content = data;
  });
  const close = vi.fn(async () => {});
  return {
    kind: 'file' as const,
    name,
    isSameEntry: vi.fn(async () => false),
    queryPermission: vi.fn(async () => 'granted' as PermissionState),
    requestPermission: vi.fn(async () => 'granted' as PermissionState),
    createWritable: vi.fn(async () => ({ write, close }) as unknown as FileSystemWritableFileStream),
    // jsdom's `File` does not implement `.text()` (only real browsers do), so
    // this test double provides one directly rather than relying on jsdom's.
    getFile: vi.fn(
      async () => ({ name, text: async () => content }) as unknown as File,
    ),
    getWrittenContent: () => content,
    write,
    close,
  };
};

describe('FileSystemAccessAdapter', () => {
  const originalShowSaveFilePicker = window.showSaveFilePicker;
  const originalShowOpenFilePicker = window.showOpenFilePicker;

  afterEach(() => {
    window.showSaveFilePicker = originalShowSaveFilePicker;
    window.showOpenFilePicker = originalShowOpenFilePicker;
  });

  describe('save / saveAs', () => {
    it('test_save_noAssociatedFile_promptsViaSaveAs_andHoldsTheHandle', async () => {
      const handle = createMockHandle('sketch.json');
      window.showSaveFilePicker = vi.fn(async () => handle as unknown as FileSystemFileHandle);
      const adapter = new FileSystemAccessAdapter();

      expect(adapter.hasAssociatedFile).toBe(false);
      const result = await adapter.save('{"a":1}', 'sketch');

      expect(window.showSaveFilePicker).toHaveBeenCalledTimes(1);
      expect(handle.write).toHaveBeenCalledWith('{"a":1}');
      expect(result).toEqual({ fileName: 'sketch.json' });
      expect(adapter.hasAssociatedFile).toBe(true);
    });

    it('test_save_withAssociatedFile_overwritesWithoutPrompting', async () => {
      const handle = createMockHandle('sketch.json');
      window.showSaveFilePicker = vi.fn(async () => handle as unknown as FileSystemFileHandle);
      const adapter = new FileSystemAccessAdapter();
      await adapter.save('{"a":1}', 'sketch');

      const result = await adapter.save('{"a":2}');

      expect(window.showSaveFilePicker).toHaveBeenCalledTimes(1); // still just the first prompt
      expect(handle.getWrittenContent()).toBe('{"a":2}');
      expect(result).toEqual({ fileName: 'sketch.json' });
    });

    it('test_saveAs_alwaysPrompts_evenWithAnAssociatedFile', async () => {
      const firstHandle = createMockHandle('sketch.json');
      const secondHandle = createMockHandle('sketch-2.json');
      const picker = vi
        .fn()
        .mockResolvedValueOnce(firstHandle as unknown as FileSystemFileHandle)
        .mockResolvedValueOnce(secondHandle as unknown as FileSystemFileHandle);
      window.showSaveFilePicker = picker;
      const adapter = new FileSystemAccessAdapter();
      await adapter.save('{"a":1}', 'sketch');

      const result = await adapter.saveAs('{"a":2}', 'sketch-2');

      expect(picker).toHaveBeenCalledTimes(2);
      expect(secondHandle.getWrittenContent()).toBe('{"a":2}');
      expect(result).toEqual({ fileName: 'sketch-2.json' });
      expect(adapter.hasAssociatedFile).toBe(true);
    });

    it('test_saveAs_userCancelsPicker_resolvesNull_andKeepsPreviousHandle', async () => {
      const handle = createMockHandle('sketch.json');
      const abortError = new DOMException('cancelled', 'AbortError');
      const picker = vi
        .fn()
        .mockResolvedValueOnce(handle as unknown as FileSystemFileHandle)
        .mockRejectedValueOnce(abortError);
      window.showSaveFilePicker = picker;
      const adapter = new FileSystemAccessAdapter();
      await adapter.save('{"a":1}', 'sketch');

      const result = await adapter.saveAs('{"a":2}', 'sketch');

      expect(result).toBeNull();
      expect(adapter.hasAssociatedFile).toBe(true);
    });
  });

  describe('open', () => {
    it('test_open_returnsFileNameAndContent_andHoldsTheHandleForLaterSave', async () => {
      const handle = createMockHandle('loaded.json', '{"b":2}');
      window.showOpenFilePicker = vi.fn(async () => [handle as unknown as FileSystemFileHandle]);
      const adapter = new FileSystemAccessAdapter();

      const result = await adapter.open();

      expect(result).toEqual({ fileName: 'loaded.json', content: '{"b":2}' });
      expect(adapter.hasAssociatedFile).toBe(true);

      // A later save overwrites the opened file without prompting again.
      const saveResult = await adapter.save('{"b":3}');
      expect(window.showSaveFilePicker).toBeUndefined();
      expect(handle.getWrittenContent()).toBe('{"b":3}');
      expect(saveResult).toEqual({ fileName: 'loaded.json' });
    });

    it('test_open_userCancelsPicker_resolvesNull', async () => {
      const abortError = new DOMException('cancelled', 'AbortError');
      window.showOpenFilePicker = vi.fn(async () => {
        throw abortError;
      });
      const adapter = new FileSystemAccessAdapter();

      const result = await adapter.open();

      expect(result).toBeNull();
      expect(adapter.hasAssociatedFile).toBe(false);
    });
  });
});
