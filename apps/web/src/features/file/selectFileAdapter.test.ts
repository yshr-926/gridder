import { afterEach, describe, expect, it } from 'vitest';
import { DownloadFallbackAdapter } from './downloadFallbackAdapter';
import { FileSystemAccessAdapter } from './fileSystemAccessAdapter';
import { selectFileAdapter, supportsFileSystemAccess } from './selectFileAdapter';

describe('selectFileAdapter / supportsFileSystemAccess', () => {
  const originalShowSaveFilePicker = window.showSaveFilePicker;
  const originalShowOpenFilePicker = window.showOpenFilePicker;

  afterEach(() => {
    window.showSaveFilePicker = originalShowSaveFilePicker;
    window.showOpenFilePicker = originalShowOpenFilePicker;
  });

  it('test_bothPickersPresent_supportsFileSystemAccessIsTrue_andSelectsThatAdapter', () => {
    window.showSaveFilePicker = async () => {
      throw new Error('unused in this test');
    };
    window.showOpenFilePicker = async () => {
      throw new Error('unused in this test');
    };

    expect(supportsFileSystemAccess()).toBe(true);
    expect(selectFileAdapter()).toBeInstanceOf(FileSystemAccessAdapter);
  });

  it('test_pickersMissing_supportsFileSystemAccessIsFalse_andSelectsTheFallback', () => {
    window.showSaveFilePicker = undefined;
    window.showOpenFilePicker = undefined;

    expect(supportsFileSystemAccess()).toBe(false);
    expect(selectFileAdapter()).toBeInstanceOf(DownloadFallbackAdapter);
  });

  it('test_onlyOnePickerPresent_supportsFileSystemAccessIsFalse', () => {
    window.showSaveFilePicker = async () => {
      throw new Error('unused in this test');
    };
    window.showOpenFilePicker = undefined;

    expect(supportsFileSystemAccess()).toBe(false);
    expect(selectFileAdapter()).toBeInstanceOf(DownloadFallbackAdapter);
  });
});
