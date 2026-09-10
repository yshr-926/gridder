import { afterEach, describe, expect, it, vi } from 'vitest';
import { DownloadFallbackAdapter } from './downloadFallbackAdapter';

/**
 * Drives `DownloadFallbackAdapter` against real DOM elements in jsdom rather
 * than mocking `document.createElement` — `<a>`/`<input>` behave close enough
 * to a real browser here, and it keeps these tests exercising the same click
 * / event wiring the adapter actually uses instead of a hand-rolled double.
 */

const fileWithText = (name: string, content: string): File => {
  const file = new File([content], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => content });
  return file;
};

describe('DownloadFallbackAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasAssociatedFile', () => {
    it('test_hasAssociatedFile_isAlwaysFalse', () => {
      expect(new DownloadFallbackAdapter().hasAssociatedFile).toBe(false);
    });
  });

  describe('save / saveAs', () => {
    it('test_saveAs_triggersADownloadLinkClick_withJsonExtension', async () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const adapter = new DownloadFallbackAdapter();

      const result = await adapter.saveAs('{"a":1}', 'my-sketch');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      expect(result).toEqual({ fileName: 'my-sketch.json' });
    });

    it('test_saveAs_nameAlreadyEndingInJson_doesNotDoubleTheExtension', async () => {
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const adapter = new DownloadFallbackAdapter();

      const result = await adapter.saveAs('{}', 'already-named.json');

      expect(result).toEqual({ fileName: 'already-named.json' });
    });

    it('test_saveAs_noSuggestedName_fallsBackToDefaultFilename', async () => {
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const adapter = new DownloadFallbackAdapter();

      const result = await adapter.saveAs('{}');

      expect(result).toEqual({ fileName: 'sketch.json' });
    });

    it('test_save_delegatesToSaveAs_everyTime', async () => {
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const adapter = new DownloadFallbackAdapter();

      await adapter.save('{}', 'one');
      await adapter.save('{}', 'one');

      // No handle is ever held, so a second save downloads again rather than
      // silently overwriting anything.
      expect(createObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('open', () => {
    it('test_open_userSelectsAFile_resolvesFileNameAndContent', async () => {
      const file = fileWithText('picked.json', '{"loaded":true}');
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
        this: HTMLInputElement
      ) {
        Object.defineProperty(this, 'files', { value: [file], configurable: true });
        this.dispatchEvent(new Event('change'));
      });
      const adapter = new DownloadFallbackAdapter();

      const result = await adapter.open();

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ fileName: 'picked.json', content: '{"loaded":true}' });
    });

    it('test_open_userCancelsThePicker_resolvesNull', async () => {
      vi.useFakeTimers();
      vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
        this: HTMLInputElement
      ) {
        // No `change` fires; the native dialog just closes, refocusing the window.
        window.dispatchEvent(new Event('focus'));
      });
      const adapter = new DownloadFallbackAdapter();

      const pending = adapter.open();
      await vi.runAllTimersAsync();
      const result = await pending;

      expect(result).toBeNull();
      vi.useRealTimers();
    });
  });
});
