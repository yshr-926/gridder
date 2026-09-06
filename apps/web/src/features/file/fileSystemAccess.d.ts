/**
 * Minimal ambient types for the File System Access API (issue #54, ADR-0004).
 * Not yet part of TypeScript's bundled `lib.dom.d.ts`, and this project adds
 * no `@types` package for it since only this narrow surface is used —
 * `showSaveFilePicker`, `showOpenFilePicker`, and just enough of the handle
 * and permission surface for {@link FileSystemAccessAdapter} to read, write,
 * and re-request permission on a held handle across page reloads.
 *
 * Chromium-only per ADR-0004; `fileAdapter.ts` feature-detects these globals
 * before ever calling them, so this file being ambient (not exercised by
 * jsdom in tests) is fine — the adapter using it has its own mocked tests.
 */

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}

interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
}
