import { DownloadFallbackAdapter } from './downloadFallbackAdapter';
import { FileSystemAccessAdapter } from './fileSystemAccessAdapter';
import type { FileAdapter } from './types';

/** Whether this browser exposes the File System Access API pickers this app needs. */
export const supportsFileSystemAccess = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.showSaveFilePicker === 'function' &&
  typeof window.showOpenFilePicker === 'function';

/**
 * Pick the file Adapter for this browser (issue #54, ADR-0004): the File
 * System Access implementation where available (Chromium), the download +
 * `<input type=file>` fallback everywhere else. Nothing above this needs to
 * branch on the platform again — `fileSession.ts` and the Header menu only
 * ever see the shared {@link FileAdapter} interface.
 */
export const selectFileAdapter = (): FileAdapter =>
  supportsFileSystemAccess() ? new FileSystemAccessAdapter() : new DownloadFallbackAdapter();
