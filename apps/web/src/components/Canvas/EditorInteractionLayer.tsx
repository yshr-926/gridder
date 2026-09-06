import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Position } from '@/types';
import {
  polygonDraftPreview,
  previewRegion,
  resizeCursorForHandle,
  useEditorInteraction,
} from '@/features/editor';
import { PolygonDraftLayer } from './PolygonDraftLayer';

/** Cursor values this layer can report (issues #43, #44, #48). */
export type EditorInteractionCursor =
  | 'grab'
  | 'grabbing'
  | 'ew-resize'
  | 'ns-resize'
  | 'nwse-resize'
  | 'nesw-resize'
  | 'crosshair';

/**
 * Imperative handle for starting polygon creation from outside this layer
 * (issue #48): the top-bar "ポリゴンを追加" button and the `P` shortcut both
 * live above `GridCanvas`, so `GridCanvas` forwards a ref down to here.
 */
export interface EditorInteractionLayerHandle {
  startPolygon: () => void;
}

/**
 * EditorInteractionLayer Props
 */
interface EditorInteractionLayerProps {
  /** Viewport offset in screen pixels. */
  panPosition: Position;
  /** Viewport scale. */
  zoom: number;
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** `#40`'s pan gesture has priority when true. */
  isViewportInteracting: boolean;
  /**
   * Reports the cursor the container should show for the move gesture
   * (issue #43) or resize handle (issue #44), or `null` when this layer has
   * no cursor opinion (the caller falls back to its own default).
   */
  onCursorChange?: (cursor: EditorInteractionCursor | null) => void;
  /**
   * Reports whether polygon creation (issue #48) is currently active, so the
   * top-bar button can show its pressed state.
   */
  onCreatingPolygonChange?: (isCreatingPolygon: boolean) => void;
}

/** `ResizeCursorAxis` -> CSS `*-resize` cursor name. */
const RESIZE_CURSOR: Record<'ew' | 'ns' | 'nwse' | 'nesw', EditorInteractionCursor> = {
  ew: 'ew-resize',
  ns: 'ns-resize',
  nwse: 'nwse-resize',
  nesw: 'nesw-resize',
};

/** Blank-drag rectangle preview fill / stroke (accent, low alpha). */
const RECT_PREVIEW_FILL = 'rgba(37, 99, 235, 0.12)';
const RECT_PREVIEW_STROKE = '#2563eb';
/** Shift-drag marquee preview fill / stroke (neutral, dashed). */
const MARQUEE_PREVIEW_FILL = 'rgba(100, 116, 139, 0.10)';
const MARQUEE_PREVIEW_STROKE = '#475569';

/**
 * The pointer-arbitration layer for the polygon editor (issues #42, #43,
 * #44, #48). A single transparent Konva rect captures pointer events across
 * the whole world and feeds them to {@link useEditorInteraction}; the drag
 * preview (blank-drag rectangle, Shift-drag marquee, or polygon-creation
 * draft) is drawn here as Konva-only nodes, so React document state is
 * never touched mid-gesture. A shape-drag move or handle-drag resize has no
 * preview node of its own here — `GridCanvas` reads the same gesture state
 * from `useMovePreviewStore` / `useResizePreviewStore` and updates the
 * affected shape's actual Konva node in `ShapesLayer` / `SelectionOverlay`
 * instead. The resize handles themselves are drawn by `SelectionOverlay`,
 * not here — this layer only decides, from the same pointer stream, whether
 * a gesture grabs one. `startPolygon` is exposed via ref so the top-bar
 * button (owned well above `GridCanvas`) can enter polygon creation.
 * Replaces the cell-era `InteractionLayer` on `GridCanvas`'s document path.
 */
export const EditorInteractionLayer = forwardRef<
  EditorInteractionLayerHandle,
  EditorInteractionLayerProps
>(({ panPosition, zoom, gridSize, isViewportInteracting, onCursorChange, onCreatingPolygonChange }, ref) => {
  const {
    state,
    hoveredHandle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    startPolygon,
  } = useEditorInteraction({
    scale: zoom,
    offset: panPosition,
    gridSize,
    isViewportInteracting,
  });

  useImperativeHandle(ref, () => ({ startPolygon }), [startPolygon]);

  const pointerFromEvent = useCallback(
    (event: KonvaEventObject<PointerEvent | MouseEvent>): Position | null => {
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      return pointer ? { x: pointer.x, y: pointer.y } : null;
    },
    []
  );

  const handleDown = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const point = pointerFromEvent(event);
      if (point) {
        onPointerDown(point, event.evt.shiftKey);
      }
    },
    [pointerFromEvent, onPointerDown]
  );

  const handleMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const point = pointerFromEvent(event);
      if (point) {
        onPointerMove(point, event.evt.shiftKey);
      }
    },
    [pointerFromEvent, onPointerMove]
  );

  const handleUp = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const point = pointerFromEvent(event);
      if (point) {
        onPointerUp(point, event.evt.shiftKey);
      }
    },
    [pointerFromEvent, onPointerUp]
  );

  // Cursor feedback for the move gesture (spec §6.1, issue #43), the resize
  // gesture (spec §6.2, issue #44), and polygon creation (spec §6.3,
  // issue #48): `grabbing` once the drag is moving a shape, `grab` while the
  // pointer is down on a shape but hasn't crossed the drag threshold yet,
  // the matching `*-resize` axis cursor while a resize handle is grabbed or
  // merely hovered, and `crosshair` for the whole polygon-creation gesture
  // (so "移動と伸縮の境界をカーソルだけで理解できる" — ui-principles §8 — extends to
  // telling direct manipulation apart from the modal creation gesture).
  // Reported to the parent so it can be applied to the Stage container,
  // matching how `#40`'s pan cursor is set on `GridCanvas`.
  const cursor: EditorInteractionCursor | null =
    state.kind === 'creatingPolygon'
      ? 'crosshair'
      : state.kind === 'resizing'
        ? RESIZE_CURSOR[resizeCursorForHandle(state.handle)]
        : state.kind === 'moving'
          ? 'grabbing'
          : state.kind === 'pending' && state.hitShapeId !== null
            ? 'grab'
            : hoveredHandle !== null
              ? RESIZE_CURSOR[resizeCursorForHandle(hoveredHandle)]
              : null;

  useEffect(() => {
    onCursorChange?.(cursor);
  }, [cursor, onCursorChange]);

  useEffect(() => {
    onCreatingPolygonChange?.(state.kind === 'creatingPolygon');
  }, [state.kind, onCreatingPolygonChange]);

  const preview = useMemo(() => {
    const region = previewRegion(state);
    if (region === null) {
      return null;
    }
    const isMarquee = state.kind === 'marquee';
    return (
      <Rect
        name={isMarquee ? 'marquee-preview' : 'rect-preview'}
        x={region.minX * gridSize}
        y={region.minY * gridSize}
        width={(region.maxX - region.minX) * gridSize}
        height={(region.maxY - region.minY) * gridSize}
        fill={isMarquee ? MARQUEE_PREVIEW_FILL : RECT_PREVIEW_FILL}
        stroke={isMarquee ? MARQUEE_PREVIEW_STROKE : RECT_PREVIEW_STROKE}
        strokeWidth={1}
        strokeScaleEnabled={false}
        dash={isMarquee ? [4, 3] : undefined}
        listening={false}
      />
    );
  }, [state, gridSize]);

  const polygonDraft = polygonDraftPreview(state);

  // A large transparent rect so pointer events land even on empty canvas.
  const size = 200000;
  const origin = -100000;

  return (
    <Group listening={!isViewportInteracting}>
      <Rect
        name="editor-interaction-surface"
        x={origin}
        y={origin}
        width={size}
        height={size}
        fill="transparent"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={onPointerCancel}
      />
      {preview}
      {polygonDraft !== null && (
        <PolygonDraftLayer
          vertices={polygonDraft.vertices}
          cursorVertex={polygonDraft.cursorVertex}
          canClose={polygonDraft.canClose}
          gridSize={gridSize}
          scale={zoom}
        />
      )}
    </Group>
  );
});

EditorInteractionLayer.displayName = 'EditorInteractionLayer';
