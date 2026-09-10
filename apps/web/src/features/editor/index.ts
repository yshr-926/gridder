export {
  createEmptyDocument,
  createRectShape,
  defaultShapeStyle,
  nextShapeFill,
  rectRingFromGridPoints,
} from './document';
export { EditorSession } from './editorSession';
export { editorSession, useEditorDocument, useEditorHistory } from './useEditorSession';
export {
  isAxisAlignedRect,
  isPointInPolygon,
  polygonBounds,
  rectContainsRect,
  rectFromPoints,
  RESIZE_HANDLE_KINDS,
  resizeCursorForHandle,
  resizeHandleAtPoint,
  resizeHandlePoint,
  resizeRectBounds,
  ringFromRect,
  shapeAtPoint,
  shapesWithinRegion,
  type GridRect,
  type ResizeCursorAxis,
  type ResizeHandleKind,
} from './hitTest';
export {
  IDLE_STATE,
  movePreview,
  polygonDraftPreview,
  previewRegion,
  reduceInteraction,
  resizePreview,
  type InteractionEffect,
  type InteractionEvent,
  type InteractionResult,
  type InteractionState,
  type PointerSample,
} from './interactionController';
export { applyInteractionEffect } from './applyInteractionEffect';
export { useEditorInteraction } from './useEditorInteraction';
export { useSelectedShapes, type SelectedShapesView } from './useSelectedShapes';
export { shapeCellSize, formatDimension, type ShapeCellSize } from './shapeDimensions';
export {
  renameShape,
  setShapesFill,
  setShapesOpacity,
  setShapesBorderVisible,
} from './inspectorCommands';
export {
  copySelection,
  pasteClipboard,
  duplicateSelection,
  deleteSelection,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
} from './editCommands';
export { useEditShortcuts } from './useEditShortcuts';
export { rotateSelection } from './rotate';
export { useRotateShortcut } from './useRotateShortcut';
export { useDrawingBounds } from './useDrawingBounds';
export { setManualDrawingBounds, fitDrawingBoundsToContent } from './drawingBoundsCommands';
export { setPhysicalScale, clearPhysicalScale } from './physicalScaleCommands';
export { setAnnotationFontSize } from './annotationFontSizeCommands';
export {
  vertexAtPoint,
  edgeAtPoint,
  isAxisAlignedPolygonEdge,
  polygonEdgeAxis,
  withVertexMoved,
  withEdgeMoved,
  vertexInsertionAtPoint,
  withVertexInserted,
  vertexInsertHitRadiusPx,
  VERTEX_INSERT_MIN_CELL_PX,
  type PolygonRingRef,
  type PolygonVertexRef,
  type PolygonEdgeRef,
  type VertexInsertionHit,
  type EdgeAxis,
} from './hitTest';
export { vertexEditPreview, handleTargetAt, type HandleTarget } from './interactionController';
export {
  groupContaining,
  resolveSelectionForGroupActions,
  resolveClickSelection,
  resolveDoubleClickTarget,
  type ClickSelectionResult,
  type DoubleClickTarget,
} from './groupSelection';
export { groupSelection, ungroupSelection } from './groupCommands';
export { combineSelection, subtractSelection } from './booleanCommands';
