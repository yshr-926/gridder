export type { FileAdapter, OpenResult, SaveResult } from './types';
export { DEFAULT_SKETCH_FILENAME } from './types';
export { FileSystemAccessAdapter } from './fileSystemAccessAdapter';
export { DownloadFallbackAdapter } from './downloadFallbackAdapter';
export { selectFileAdapter, supportsFileSystemAccess } from './selectFileAdapter';
export { useIsDirty, isDirty, markSaved } from './dirtyTracking';
export { useBeforeUnload } from './useBeforeUnload';
export { startNewSketch, openSketchFile, saveSketch, saveSketchAs } from './fileSession';
export { useFileMenu, type FileMenuControls, type PendingConfirmAction } from './useFileMenu';
