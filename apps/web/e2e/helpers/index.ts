// Test setup and fixtures
export {
  test,
  expect,
  TEST_DATA,
  TIMEOUTS,
  waitFor,
  waitForAnimationFrame,
  retryUntil,
} from './setup';

// Custom assertions
export {
  customExpect,
  expectCanvasHasContent,
  expectCanvasIsEmpty,
  expectLocalStorageHasProject,
  expectDownload,
  expectElementFocused,
  expectTabNavigation,
  expectObjectCount,
  expectToolbarVisible,
  expectPropertyPanelVisible,
  expectStatusBarVisible,
  expectNoConsoleErrors,
  expectModalVisible,
  expectNoModal,
} from './assertions';

// Canvas helpers
export {
  CanvasHelper,
  getCanvasPixelColor,
  isCellFilled,
  drawCellLine,
  clickGridCell,
  getFilledCellCount,
} from './canvas';
