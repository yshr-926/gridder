export {
  createEmptyDocument,
  createRectShape,
  defaultShapeStyle,
  nextShapeFill,
  rectRingFromGridPoints,
} from './document';
export { EditorSession } from './editorSession';
export {
  editorSession,
  useEditorDocument,
  useEditorHistory,
} from './useEditorSession';
export {
  isPointInPolygon,
  polygonBounds,
  rectContainsRect,
  rectFromPoints,
  shapeAtPoint,
  shapesWithinRegion,
  type GridRect,
} from './hitTest';
export {
  IDLE_STATE,
  previewRegion,
  reduceInteraction,
  type InteractionEffect,
  type InteractionEvent,
  type InteractionResult,
  type InteractionState,
  type PointerSample,
} from './interactionController';
export { applyInteractionEffect } from './applyInteractionEffect';
export { useEditorInteraction } from './useEditorInteraction';
