// Types
export type {
  ProjectData,
  ProjectMetadata,
  ExportGridSettings,
  ExportOptions,
  ImageExportOptions,
  ImageFormat,
} from './types';
export { PROJECT_DATA_VERSION } from './types';

// Validation
export {
  validateProjectData,
  ProjectValidationError,
  isProjectData,
  isGridObject,
} from './validation';
export type { ValidationErrorPath } from './validation';

// Export Project (JSON)
export {
  createProjectData,
  updateProjectData,
  exportProjectAsJSON,
  downloadProjectData,
  serializeProjectData,
  generateFilename,
} from './exportProject';

// Import Project
export {
  importProjectFromJSON,
  importProjectFromFile,
  applyProjectData,
  importAndApplyFromFile,
  createNewProject,
  hasUnsavedChanges,
} from './importProject';
export type { ImportResult, ImportErrorType } from './importProject';

// Export Image (PNG/JPEG)
export {
  exportStageAsImage,
  exportAsPNG,
  exportAsJPEG,
  exportImage,
  generateImageFilename,
  downloadDataURL,
} from './exportImage';

// AutoSave
export {
  useAutoSave,
  useRestoreConfirmation,
  saveToLocalStorage,
  loadFromLocalStorage,
  restoreFromLocalStorage,
  clearLocalStorage,
  hasAutoSavedData,
  getLastAutoSaveTime,
  STORAGE_KEY,
  STORAGE_TIME_KEY,
  AUTOSAVE_DELAY,
} from './autoSave';
