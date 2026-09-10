// Test setup and fixtures
export { test, expect, GRID_SIZE } from './setup';

// Canvas helper (grid-vertex <-> screen conversion, zoom/pan gestures)
export { CanvasHelper } from './canvas';

// Editor-core runtime readers (document / selection snapshots)
export {
  readDocument,
  readShapeCount,
  readSelection,
  requireShape,
  type E2eDocumentSnapshot,
  type E2eSelectionSnapshot,
  type E2eShape,
  type E2eShapeStyle,
} from './editorState';

// Custom assertions
export { expectModalVisible, expectNoModal, expectNoConsoleErrors } from './assertions';
