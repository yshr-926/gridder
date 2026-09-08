import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { GridPoint } from '@gridder/editor-core';
import type { Position } from '@/types';
import {
  editorSession,
  groupContaining,
  polygonDraftPreview,
  polygonEdgeAxis,
  previewRegion,
  resizeCursorForHandle,
  resolveDoubleClickTarget,
  shapeAtPoint,
  useEditorInteraction,
  type EdgeAxis,
  type HandleTarget,
} from '@/features/editor';
import { readViewportTransform, screenToGrid } from '@/features/viewport';
import { useSelectionStore } from '@/stores/selectionStore';
import { PolygonDraftLayer } from './PolygonDraftLayer';

/** Cursor values this layer can report (issues #43, #44, #48, #50, #64). */
export type EditorInteractionCursor =
  | 'grab'
  | 'grabbing'
  | 'ew-resize'
  | 'ns-resize'
  | 'nwse-resize'
  | 'nesw-resize'
  | 'move'
  | 'copy'
  | 'crosshair';

/**
 * A ghost vertex under the pointer (issue #64): the grid point on the single
 * selected shape's edge where a press would insert a vertex. Reported to
 * `GridCanvas` so `VertexEditOverlay` can draw it.
 */
export interface VertexInsertGhost {
  readonly shapeId: string;
  readonly point: GridPoint;
}

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
  /**
   * Viewport scale, for the zoom-invariant polygon-draft markers. Pointer
   * conversion reads the live transform (`readViewportTransform`) at event
   * time instead, so a pan never re-renders this layer (issue #61).
   */
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
   * Reports the ghost vertex under the pointer (issue #64), or `null` when
   * there is none, so the caller can draw it in `VertexEditOverlay`.
   */
  onInsertGhostChange?: (ghost: VertexInsertGhost | null) => void;
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

/**
 * Cursor for dragging or hovering an edge (issue #50): an axis-aligned edge
 * slides perpendicular to itself, so the `ns` / `ew` axis is the one the
 * edge does *not* run along; a diagonal edge moves freely.
 */
const EDGE_CURSOR: Record<EdgeAxis, EditorInteractionCursor> = {
  horizontal: 'ns-resize',
  vertical: 'ew-resize',
  diagonal: 'move',
};

/** Cursor for whatever handle is under the idle pointer, or `null` off any handle. */
const hoverCursor = (target: HandleTarget | null): EditorInteractionCursor | null => {
  if (target === null) {
    return null;
  }
  switch (target.kind) {
    case 'resizeHandle':
      return RESIZE_CURSOR[resizeCursorForHandle(target.handle)];
    case 'vertex':
      return 'move';
    case 'insertVertex':
      return 'copy';
    case 'edge':
      return EDGE_CURSOR[target.axis];
  }
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
>((props, ref) => {
  const {
    zoom,
    gridSize,
    isViewportInteracting,
    onCursorChange,
    onInsertGhostChange,
    onCreatingPolygonChange,
  } = props;
  const {
    state,
    hoverTarget,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    startPolygon,
  } = useEditorInteraction({
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

  /**
   * A double-click resolves through `resolveDoubleClickTarget` (issue #52):
   * `'enter-group'` — the shape belongs to a group not currently entered —
   * puts that group into individual-selection mode with the double-clicked
   * shape selected alone (spec §7 "ダブルクリックで構成図形を個別選択できる").
   * `'none'` (an ungrouped shape, or one already inside its entered group)
   * does nothing: the cell-editing double-click of issue #49 was retired by
   * issue #62.
   */
  const handleDoubleClick = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const point = pointerFromEvent(event);
      if (point === null) {
        return;
      }
      const gridPoint = screenToGrid(point, readViewportTransform(), gridSize);
      const document = editorSession.getDocument();
      const shape = shapeAtPoint(document, gridPoint);
      if (shape === null) {
        return;
      }
      const activeGroupId = useSelectionStore.getState().activeGroupId;
      const target = resolveDoubleClickTarget(document, activeGroupId, shape.id);
      if (target === 'enter-group') {
        const group = groupContaining(document, shape.id);
        if (group !== null) {
          useSelectionStore.getState().enterGroup(group.id, [shape.id]);
        }
      }
    },
    [pointerFromEvent, gridSize]
  );

  // Cursor feedback for the move gesture (spec §6.1, issue #43), the resize
  // gesture (spec §6.2, issue #44), vertex / edge dragging (issue #50), ghost
  // vertices (issue #64), and polygon creation (spec §6.3, issue #48):
  // `grabbing` once the drag is moving a shape, `grab` while the pointer is
  // down on a shape but hasn't crossed the drag threshold yet, the matching
  // `*-resize` axis cursor while a resize handle — or an axis-aligned edge —
  // is grabbed or merely hovered, `move` for a vertex or a diagonal edge,
  // `copy` over a ghost vertex (so "移動と伸縮の境界をカーソルだけで理解できる" —
  // ui-principles §8 — also tells inserting apart from sliding the same edge),
  // and `crosshair` for the whole polygon-creation gesture. Reported to the
  // parent so it can be applied to the Stage container, matching how `#40`'s
  // pan cursor is set on `GridCanvas`.
  const cursor: EditorInteractionCursor | null =
    state.kind === 'creatingPolygon'
      ? 'crosshair'
      : state.kind === 'resizing'
        ? RESIZE_CURSOR[resizeCursorForHandle(state.handle)]
        : state.kind === 'moving'
          ? 'grabbing'
          : state.kind === 'movingVertex'
            ? 'move'
            : state.kind === 'movingEdge'
              ? EDGE_CURSOR[polygonEdgeAxis(state.originPolygon, state.edge)]
              : state.kind === 'pending' && state.hitShapeId !== null
                ? 'grab'
                : hoverCursor(hoverTarget);

  useEffect(() => {
    onCursorChange?.(cursor);
  }, [cursor, onCursorChange]);

  const insertGhost = useMemo<VertexInsertGhost | null>(
    () =>
      hoverTarget !== null && hoverTarget.kind === 'insertVertex'
        ? { shapeId: hoverTarget.shapeId, point: hoverTarget.hit.point }
        : null,
    [hoverTarget]
  );

  useEffect(() => {
    onInsertGhostChange?.(insertGhost);
  }, [insertGhost, onInsertGhostChange]);

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
        onDblClick={handleDoubleClick}
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
