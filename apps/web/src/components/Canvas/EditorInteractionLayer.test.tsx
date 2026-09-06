import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CreateShapeCommand, GroupShapesCommand } from '@gridder/editor-core';
import { EditorInteractionLayer } from './EditorInteractionLayer';
import { editorSession } from '@/features/editor';
import { useSelectionStore } from '@/stores/selectionStore';
import { useMovePreviewStore } from '@/stores/movePreviewStore';
import { useResizePreviewStore } from '@/stores/resizePreviewStore';
import { useShapeEditPreviewStore } from '@/stores/shapeEditPreviewStore';
import { useToastStore } from '@/hooks/useToast';

/**
 * Mock react-konva so the transparent surface is a real DOM node whose pointer
 * handlers we can fire. `getStage().getPointerPosition()` returns whatever the
 * event carries as `clientX` / `clientY` so a test can place the pointer in grid
 * space (gridSize is 20, scale 1, offset 0 in these tests).
 */
vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Rect: ({
    name,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onDblClick,
    ...props
  }: Record<string, unknown>) => {
    const makeEvent = (e: {
      clientX?: number;
      clientY?: number;
      shiftKey?: boolean;
      altKey?: boolean;
    }) => ({
      evt: { shiftKey: e.shiftKey ?? false, altKey: e.altKey ?? false },
      target: {
        getStage: () => ({
          getPointerPosition: () => ({ x: e.clientX ?? 0, y: e.clientY ?? 0 }),
        }),
      },
    });
    return (
      <div
        data-testid="konva-rect"
        data-name={String(name ?? '')}
        data-x={String(props.x ?? '')}
        data-y={String(props.y ?? '')}
        data-width={String(props.width ?? '')}
        data-height={String(props.height ?? '')}
        onPointerDown={
          onPointerDown
            ? (e) =>
                (onPointerDown as (ev: unknown) => void)(
                  makeEvent(
                    e as unknown as {
                      clientX: number;
                      clientY: number;
                      shiftKey: boolean;
                      altKey: boolean;
                    }
                  )
                )
            : undefined
        }
        onPointerMove={
          onPointerMove
            ? (e) =>
                (onPointerMove as (ev: unknown) => void)(
                  makeEvent(
                    e as unknown as {
                      clientX: number;
                      clientY: number;
                      shiftKey: boolean;
                      altKey: boolean;
                    }
                  )
                )
            : undefined
        }
        onPointerUp={
          onPointerUp
            ? (e) =>
                (onPointerUp as (ev: unknown) => void)(
                  makeEvent(
                    e as unknown as {
                      clientX: number;
                      clientY: number;
                      shiftKey: boolean;
                      altKey: boolean;
                    }
                  )
                )
            : undefined
        }
        onPointerCancel={
          onPointerCancel ? () => (onPointerCancel as () => void)() : undefined
        }
        onDoubleClick={
          onDblClick
            ? (e) =>
                (onDblClick as (ev: unknown) => void)(
                  makeEvent(e as unknown as { clientX: number; clientY: number })
                )
            : undefined
        }
      />
    );
  },
  // Konva-only nodes drawn by PolygonDraftLayer (issue #48): no pointer
  // handlers to wire up, just enough of a stub for it to render inside this
  // layer's tree without throwing.
  Line: (props: Record<string, unknown>) => (
    <div data-testid="konva-line" data-name={String(props.name ?? '')} />
  ),
  Circle: (props: Record<string, unknown>) => (
    <div data-testid="konva-circle" data-name={String(props.name ?? '')} />
  ),
}));

const surface = (container: HTMLElement): HTMLElement => {
  const node = container.querySelector('[data-name="editor-interaction-surface"]');
  if (node === null) {
    throw new Error('interaction surface not found');
  }
  return node as HTMLElement;
};

const preview = (container: HTMLElement): HTMLElement | null =>
  (container.querySelector('[data-name="rect-preview"]') ??
    container.querySelector('[data-name="marquee-preview"]')) as HTMLElement | null;

/** Undo everything currently on the session so each test starts empty. */
const drainSession = () => {
  while (editorSession.canUndo) {
    editorSession.undo();
  }
};

const defaultProps = {
  panPosition: { x: 0, y: 0 },
  zoom: 1,
  gridSize: 20,
  isViewportInteracting: false,
};

describe('EditorInteractionLayer', () => {
  beforeEach(() => {
    drainSession();
    useSelectionStore.setState({ selectedIds: [], primaryId: null, activeGroupId: null });
    useMovePreviewStore.setState({ preview: null });
    useResizePreviewStore.setState({ preview: null });
    useShapeEditPreviewStore.setState({ preview: null });
    useToastStore.setState({ toasts: [] });
  });

  it('test_EditorInteractionLayer_blankDrag_createsRectViaOneCommand_andSelectsIt', () => {
    const shapesBefore = editorSession.shapeCount;
    const { container } = render(<EditorInteractionLayer {...defaultProps} />);
    const node = surface(container);

    // Grid vertex (1,1) -> (5,4) at gridSize 20.
    fireEvent.pointerDown(node, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(node, { clientX: 100, clientY: 80 });
    expect(preview(container)?.getAttribute('data-name')).toBe('rect-preview');
    fireEvent.pointerUp(node, { clientX: 100, clientY: 80 });

    expect(editorSession.shapeCount).toBe(shapesBefore + 1);
    expect(editorSession.canUndo).toBe(true);
    expect(useSelectionStore.getState().selectedIds).toHaveLength(1);

    // Undo removes the shape (acceptance: creation is undoable).
    editorSession.undo();
    expect(editorSession.shapeCount).toBe(shapesBefore);
  });

  it('test_EditorInteractionLayer_blankClick_clearsSelection', () => {
    useSelectionStore.setState({ selectedIds: ['stale'], primaryId: 'stale' });
    const { container } = render(<EditorInteractionLayer {...defaultProps} />);
    const node = surface(container);

    fireEvent.pointerDown(node, { clientX: 300, clientY: 300 });
    fireEvent.pointerUp(node, { clientX: 300, clientY: 300 });

    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('test_EditorInteractionLayer_clickOnCreatedShape_selectsIt', () => {
    const { container } = render(<EditorInteractionLayer {...defaultProps} />);
    const node = surface(container);

    // Create a rect covering grid (1,1)-(6,6) => pixels 20..120.
    fireEvent.pointerDown(node, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(node, { clientX: 120, clientY: 120 });
    fireEvent.pointerUp(node, { clientX: 120, clientY: 120 });
    const createdId = useSelectionStore.getState().selectedIds[0];
    useSelectionStore.setState({ selectedIds: [], primaryId: null });

    // Click inside it.
    fireEvent.pointerDown(node, { clientX: 60, clientY: 60 });
    fireEvent.pointerUp(node, { clientX: 60, clientY: 60 });

    expect(useSelectionStore.getState().selectedIds).toEqual([createdId]);
  });

  it('test_EditorInteractionLayer_shiftDrag_marqueeSelectsContainedShape', () => {
    const { container } = render(<EditorInteractionLayer {...defaultProps} />);
    const node = surface(container);

    // Small shape around grid (2,2)-(4,4).
    fireEvent.pointerDown(node, { clientX: 40, clientY: 40 });
    fireEvent.pointerMove(node, { clientX: 80, clientY: 80 });
    fireEvent.pointerUp(node, { clientX: 80, clientY: 80 });
    const createdId = useSelectionStore.getState().selectedIds[0];
    useSelectionStore.setState({ selectedIds: [], primaryId: null });

    // Shift-drag a marquee that fully contains it: grid (0,0)-(8,8).
    fireEvent.pointerDown(node, { clientX: 0, clientY: 0, shiftKey: true });
    fireEvent.pointerMove(node, { clientX: 160, clientY: 160, shiftKey: true });
    expect(preview(container)?.getAttribute('data-name')).toBe('marquee-preview');
    fireEvent.pointerUp(node, { clientX: 160, clientY: 160, shiftKey: true });

    expect(useSelectionStore.getState().selectedIds).toEqual([createdId]);
  });

  it('test_EditorInteractionLayer_ignoresPointer_whileViewportInteracting', () => {
    const shapesBefore = editorSession.shapeCount;
    const { container } = render(
      <EditorInteractionLayer {...defaultProps} isViewportInteracting={true} />
    );
    const node = surface(container);

    fireEvent.pointerDown(node, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(node, { clientX: 100, clientY: 80 });
    fireEvent.pointerUp(node, { clientX: 100, clientY: 80 });

    expect(editorSession.shapeCount).toBe(shapesBefore);
    expect(preview(container)).toBeNull();
  });

  describe('shape drag move (issue #43)', () => {
    it('test_EditorInteractionLayer_dragOnShape_selectsIt_movesByIntegerDelta_andCommitsOneUndoStep', () => {
      const shape = { id: 'move-a', polygon: { outerRing: [
        { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 },
      ], innerRings: [] }, style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true } };
      editorSession.dispatch(new CreateShapeCommand(shape));
      useSelectionStore.setState({ selectedIds: [], primaryId: null });

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      // Pointer down inside the shape (grid (2,2) => px (40,40)), drag to (4,4) => px (80,80).
      fireEvent.pointerDown(node, { clientX: 40, clientY: 40 });
      fireEvent.pointerMove(node, { clientX: 80, clientY: 80 });

      // Mid-drag: selection happened, but the document is untouched (Konva-only preview).
      expect(useSelectionStore.getState().selectedIds).toEqual(['move-a']);
      expect(editorSession.getDocument().shapes['move-a'].polygon.outerRing).toEqual(
        shape.polygon.outerRing
      );

      fireEvent.pointerUp(node, { clientX: 80, clientY: 80 });

      const moved = editorSession.getDocument().shapes['move-a'].polygon.outerRing;
      expect(moved).toEqual([
        { x: 3, y: 3 },
        { x: 5, y: 3 },
        { x: 5, y: 5 },
        { x: 3, y: 5 },
      ]);
      for (const point of moved) {
        expect(Number.isInteger(point.x)).toBe(true);
        expect(Number.isInteger(point.y)).toBe(true);
      }

      // One undo restores the pre-move geometry — the whole gesture is a
      // single undo step, distinct from the earlier create.
      editorSession.undo();
      expect(editorSession.getDocument().shapes['move-a'].polygon.outerRing).toEqual(
        shape.polygon.outerRing
      );
      // The shape still exists: only the move was undone, not the create.
      expect(editorSession.getDocument().shapes['move-a']).toBeDefined();

      // A second undo removes the shape (the earlier create Command).
      editorSession.undo();
      expect(editorSession.getDocument().shapes['move-a']).toBeUndefined();
    });

    it('test_EditorInteractionLayer_dragOnShape_clearsMovePreview_onPointerUp', () => {
      const shape = { id: 'move-b', polygon: { outerRing: [
        { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
      ], innerRings: [] }, style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true } };
      editorSession.dispatch(new CreateShapeCommand(shape));

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.pointerDown(node, { clientX: 10, clientY: 10 });
      fireEvent.pointerMove(node, { clientX: 60, clientY: 60 });
      expect(useMovePreviewStore.getState().preview).not.toBeNull();

      fireEvent.pointerUp(node, { clientX: 60, clientY: 60 });
      expect(useMovePreviewStore.getState().preview).toBeNull();
    });

    it('test_EditorInteractionLayer_moveDrag_throttlesRapidPointerMoves_to16ms', () => {
      const shape = { id: 'move-throttle', polygon: { outerRing: [
        { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
      ], innerRings: [] }, style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true } };
      editorSession.dispatch(new CreateShapeCommand(shape));

      let now = 1_000;
      const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.pointerDown(node, { clientX: 40, clientY: 40 });
      fireEvent.pointerMove(node, { clientX: 60, clientY: 40 }); // enters `moving`
      const afterFirstMove = useMovePreviewStore.getState().preview;

      // A second move 5ms later (< 16ms) is throttled away: the preview
      // delta does not advance to the new pointer position.
      now += 5;
      fireEvent.pointerMove(node, { clientX: 200, clientY: 200 });
      expect(useMovePreviewStore.getState().preview).toEqual(afterFirstMove);

      // A move at +20ms (> 16ms) is let through.
      now += 20;
      fireEvent.pointerMove(node, { clientX: 200, clientY: 200 });
      expect(useMovePreviewStore.getState().preview).not.toEqual(afterFirstMove);

      nowSpy.mockRestore();
    });

    it('test_EditorInteractionLayer_multiSelectDrag_movesEverySelectedShape_bySameDelta', () => {
      const shapeA = { id: 'multi-a', polygon: { outerRing: [
        { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
      ], innerRings: [] }, style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true } };
      const shapeB = { id: 'multi-b', polygon: { outerRing: [
        { x: 10, y: 10 }, { x: 12, y: 10 }, { x: 12, y: 12 }, { x: 10, y: 12 },
      ], innerRings: [] }, style: { fill: '#ef4444' as const, opacity: 0.8, isBorderVisible: true } };
      editorSession.dispatch(new CreateShapeCommand(shapeA));
      editorSession.dispatch(new CreateShapeCommand(shapeB));
      useSelectionStore.setState({ selectedIds: ['multi-a', 'multi-b'], primaryId: 'multi-b' });

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      // Drag starting inside 'multi-a', already part of the selection: grid
      // (1,1) => px (20,20) to grid (3,2) => px (60,40).
      fireEvent.pointerDown(node, { clientX: 20, clientY: 20 });
      fireEvent.pointerMove(node, { clientX: 60, clientY: 40 });
      fireEvent.pointerUp(node, { clientX: 60, clientY: 40 });

      // Selection is unchanged (no reselect) and both shapes moved by (2, 1).
      expect(useSelectionStore.getState().selectedIds).toEqual(['multi-a', 'multi-b']);
      expect(editorSession.getDocument().shapes['multi-a'].polygon.outerRing[0]).toEqual({
        x: 2,
        y: 1,
      });
      expect(editorSession.getDocument().shapes['multi-b'].polygon.outerRing[0]).toEqual({
        x: 12,
        y: 11,
      });

      // One undo reverts both.
      editorSession.undo();
      expect(editorSession.getDocument().shapes['multi-a'].polygon.outerRing).toEqual(
        shapeA.polygon.outerRing
      );
      expect(editorSession.getDocument().shapes['multi-b'].polygon.outerRing).toEqual(
        shapeB.polygon.outerRing
      );
    });
  });

  describe('rectangle handle resize (issue #44)', () => {
    it('test_EditorInteractionLayer_dragSeHandle_resizesByIntegerDelta_andCommitsOneUndoStep', () => {
      const shape = {
        id: 'resize-a',
        polygon: {
          outerRing: [
            { x: 1, y: 1 },
            { x: 3, y: 1 },
            { x: 3, y: 3 },
            { x: 1, y: 3 },
          ],
          innerRings: [],
        },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(shape));
      useSelectionStore.setState({ selectedIds: ['resize-a'], primaryId: 'resize-a' });

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      // 'se' handle at grid (3,3) => px (60,60); drag to grid (6,7) => px (120,140).
      fireEvent.pointerDown(node, { clientX: 60, clientY: 60 });
      fireEvent.pointerMove(node, { clientX: 120, clientY: 140 });

      // Mid-drag: preview only, document untouched.
      expect(useResizePreviewStore.getState().preview).toEqual({
        shapeId: 'resize-a',
        bounds: { minX: 1, minY: 1, maxX: 6, maxY: 7 },
      });
      expect(editorSession.getDocument().shapes['resize-a'].polygon.outerRing).toEqual(
        shape.polygon.outerRing
      );

      fireEvent.pointerUp(node, { clientX: 120, clientY: 140 });

      const resized = editorSession.getDocument().shapes['resize-a'].polygon.outerRing;
      expect(resized).toEqual([
        { x: 1, y: 1 },
        { x: 6, y: 1 },
        { x: 6, y: 7 },
        { x: 1, y: 7 },
      ]);
      for (const point of resized) {
        expect(Number.isInteger(point.x)).toBe(true);
        expect(Number.isInteger(point.y)).toBe(true);
      }
      expect(useResizePreviewStore.getState().preview).toBeNull();

      // One undo restores the pre-resize geometry, distinct from the create.
      editorSession.undo();
      expect(editorSession.getDocument().shapes['resize-a'].polygon.outerRing).toEqual(
        shape.polygon.outerRing
      );
      expect(editorSession.getDocument().shapes['resize-a']).toBeDefined();

      editorSession.undo();
      expect(editorSession.getDocument().shapes['resize-a']).toBeUndefined();
    });

    it('test_EditorInteractionLayer_dragEHandle_pastOppositeEdge_flipsAndNormalizes', () => {
      const shape = {
        id: 'resize-flip',
        polygon: {
          outerRing: [
            { x: 2, y: 2 },
            { x: 6, y: 2 },
            { x: 6, y: 6 },
            { x: 2, y: 6 },
          ],
          innerRings: [],
        },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(shape));
      useSelectionStore.setState({ selectedIds: ['resize-flip'], primaryId: 'resize-flip' });

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      // 'e' handle at grid (6,4) => px (120,80); drag past the west edge (2)
      // to grid (0,4) => px (0,80).
      fireEvent.pointerDown(node, { clientX: 120, clientY: 80 });
      fireEvent.pointerMove(node, { clientX: 0, clientY: 80 });
      fireEvent.pointerUp(node, { clientX: 0, clientY: 80 });

      const resized = editorSession.getDocument().shapes['resize-flip'].polygon.outerRing;
      expect(resized).toEqual([
        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 6 },
        { x: 0, y: 6 },
      ]);
    });

    it('test_EditorInteractionLayer_clickOnHandle_withNoDrag_commitsNothing', () => {
      const shape = {
        id: 'resize-click',
        polygon: {
          outerRing: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
          ],
          innerRings: [],
        },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(shape));
      useSelectionStore.setState({ selectedIds: ['resize-click'], primaryId: 'resize-click' });
      const undoDepthBefore = editorSession.canUndo;

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.pointerDown(node, { clientX: 80, clientY: 80 }); // 'se' handle
      fireEvent.pointerUp(node, { clientX: 80, clientY: 80 });

      expect(editorSession.canUndo).toBe(undoDepthBefore);
      expect(editorSession.getDocument().shapes['resize-click'].polygon.outerRing).toEqual(
        shape.polygon.outerRing
      );
    });

    it('test_EditorInteractionLayer_handleDrag_takesPriorityOverMove', () => {
      const shape = {
        id: 'resize-priority',
        polygon: {
          outerRing: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
          ],
          innerRings: [],
        },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(shape));
      useSelectionStore.setState({ selectedIds: ['resize-priority'], primaryId: 'resize-priority' });

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      // Pointer-down exactly on the 'se' corner handle, inside the shape body.
      fireEvent.pointerDown(node, { clientX: 80, clientY: 80 });
      fireEvent.pointerMove(node, { clientX: 120, clientY: 120 });

      // A resize preview exists, never a move preview.
      expect(useResizePreviewStore.getState().preview).not.toBeNull();
      expect(useMovePreviewStore.getState().preview).toBeNull();

      fireEvent.pointerUp(node, { clientX: 120, clientY: 120 });
    });

    it('test_EditorInteractionLayer_multipleSelected_handlesDoNotIntercept_dragMovesInstead', () => {
      const shapeA = {
        id: 'multi-resize-a',
        polygon: {
          outerRing: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
          ],
          innerRings: [],
        },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      const shapeB = {
        id: 'multi-resize-b',
        polygon: {
          outerRing: [
            { x: 10, y: 10 },
            { x: 12, y: 10 },
            { x: 12, y: 12 },
            { x: 10, y: 12 },
          ],
          innerRings: [],
        },
        style: { fill: '#ef4444' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(shapeA));
      editorSession.dispatch(new CreateShapeCommand(shapeB));
      useSelectionStore.setState({
        selectedIds: ['multi-resize-a', 'multi-resize-b'],
        primaryId: 'multi-resize-b',
      });

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      // Pointer-down on 'multi-resize-a's 'se' corner (4,4) => px (80,80):
      // with 2 shapes selected, no handles exist, so this starts a move.
      fireEvent.pointerDown(node, { clientX: 80, clientY: 80 });
      fireEvent.pointerMove(node, { clientX: 100, clientY: 80 });
      fireEvent.pointerUp(node, { clientX: 100, clientY: 80 });

      expect(useResizePreviewStore.getState().preview).toBeNull();
      expect(editorSession.getDocument().shapes['multi-resize-a'].polygon.outerRing[0]).toEqual({
        x: 1,
        y: 0,
      });
    });

    it('test_EditorInteractionLayer_reportsResizeCursor_forHoverAndDrag', () => {
      const shape = {
        id: 'resize-cursor',
        polygon: {
          outerRing: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
          ],
          innerRings: [],
        },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(shape));
      useSelectionStore.setState({ selectedIds: ['resize-cursor'], primaryId: 'resize-cursor' });

      const onCursorChange = vi.fn();
      const { container } = render(
        <EditorInteractionLayer {...defaultProps} onCursorChange={onCursorChange} />
      );
      const node = surface(container);

      // Hover over the 'e' handle (4,2) => px (80,40) with no button down.
      fireEvent.pointerMove(node, { clientX: 80, clientY: 40 });
      expect(onCursorChange).toHaveBeenLastCalledWith('ew-resize');

      // Grab the 'nw' corner (0,0) and drag: 'nwse-resize' while dragging.
      fireEvent.pointerDown(node, { clientX: 0, clientY: 0 });
      fireEvent.pointerMove(node, { clientX: -20, clientY: -20 });
      expect(onCursorChange).toHaveBeenLastCalledWith('nwse-resize');

      fireEvent.pointerUp(node, { clientX: -20, clientY: -20 });
    });
  });

  describe('polygon creation (issue #48)', () => {
    it('test_pKey_startsPolygonCreation_andSetsCrosshairCursor', () => {
      const onCursorChange = vi.fn();
      render(<EditorInteractionLayer {...defaultProps} onCursorChange={onCursorChange} />);

      fireEvent.keyDown(window, { key: 'p' });

      expect(onCursorChange).toHaveBeenLastCalledWith('crosshair');
    });

    it('test_pKey_whileInputFocused_isIgnored', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const onCursorChange = vi.fn();
      render(<EditorInteractionLayer {...defaultProps} onCursorChange={onCursorChange} />);

      fireEvent.keyDown(input, { key: 'p' });

      expect(onCursorChange).not.toHaveBeenCalledWith('crosshair');
      document.body.removeChild(input);
    });

    it('test_clickThreeVertices_thenEnter_confirmsTriangle_asOneCommand_andSelectsIt', () => {
      const shapesBefore = editorSession.shapeCount;
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.keyDown(window, { key: 'p' });
      // Grid (0,0), (4,0), (2,4) at gridSize 20 => px (0,0), (80,0), (40,80).
      fireEvent.pointerDown(node, { clientX: 0, clientY: 0 });
      fireEvent.pointerDown(node, { clientX: 80, clientY: 0 });
      fireEvent.pointerDown(node, { clientX: 40, clientY: 80 });
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(editorSession.shapeCount).toBe(shapesBefore + 1);
      const newId = useSelectionStore.getState().selectedIds[0];
      expect(newId).toBeDefined();
      expect(editorSession.getDocument().shapes[newId].polygon.outerRing).toEqual([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 4 },
      ]);

      // One undo removes the whole gesture.
      editorSession.undo();
      expect(editorSession.shapeCount).toBe(shapesBefore);
    });

    it('test_clickOnStartVertexAgain_closesAConcaveShape_asOneCommand', () => {
      const shapesBefore = editorSession.shapeCount;
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.keyDown(window, { key: 'p' });
      // An L-shape (concave), grid units -> px at gridSize 20.
      const gridVertices: Array<[number, number]> = [
        [0, 0],
        [4, 0],
        [4, 2],
        [2, 2],
        [2, 4],
        [0, 4],
      ];
      for (const [x, y] of gridVertices) {
        fireEvent.pointerDown(node, { clientX: x * 20, clientY: y * 20 });
      }
      // Click back on the start vertex (0,0) to close.
      fireEvent.pointerDown(node, { clientX: 0, clientY: 0 });

      expect(editorSession.shapeCount).toBe(shapesBefore + 1);
      const newId = useSelectionStore.getState().selectedIds[0];
      expect(editorSession.getDocument().shapes[newId].polygon.outerRing).toEqual(
        gridVertices.map(([x, y]) => ({ x, y }))
      );
    });

    it('test_selfIntersectingPolygon_isRejected_noShapeCreated_documentUnchanged', () => {
      const shapesBefore = editorSession.shapeCount;
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.keyDown(window, { key: 'p' });
      // A bow-tie: (0,0), (4,4), (4,0), (0,4) — the two diagonals cross.
      fireEvent.pointerDown(node, { clientX: 0, clientY: 0 });
      fireEvent.pointerDown(node, { clientX: 80, clientY: 80 });
      fireEvent.pointerDown(node, { clientX: 80, clientY: 0 });
      fireEvent.pointerDown(node, { clientX: 0, clientY: 80 });
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(editorSession.shapeCount).toBe(shapesBefore);
      expect(editorSession.canUndo).toBe(false);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].type).toBe('error');
    });

    it('test_escapeKey_discardsTheDraft_noShapeCreated', () => {
      const shapesBefore = editorSession.shapeCount;
      const onCursorChange = vi.fn();
      const { container } = render(
        <EditorInteractionLayer {...defaultProps} onCursorChange={onCursorChange} />
      );
      const node = surface(container);

      fireEvent.keyDown(window, { key: 'p' });
      fireEvent.pointerDown(node, { clientX: 0, clientY: 0 });
      fireEvent.pointerDown(node, { clientX: 80, clientY: 0 });
      expect(container.querySelector('[data-name="polygon-draft-edges"]')).not.toBeNull();

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(editorSession.shapeCount).toBe(shapesBefore);
      expect(editorSession.canUndo).toBe(false);
      expect(container.querySelector('[data-name="polygon-draft-edges"]')).toBeNull();
      expect(onCursorChange).toHaveBeenLastCalledWith(null);
    });

    it('test_enterWithFewerThanThreeVertices_doesNotConfirm_stillCreating', () => {
      const shapesBefore = editorSession.shapeCount;
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.keyDown(window, { key: 'p' });
      fireEvent.pointerDown(node, { clientX: 0, clientY: 0 });
      fireEvent.pointerDown(node, { clientX: 80, clientY: 0 });
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(editorSession.shapeCount).toBe(shapesBefore);
      // Still in creation mode: a further click adds a third vertex normally.
      fireEvent.pointerDown(node, { clientX: 40, clientY: 80 });
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(editorSession.shapeCount).toBe(shapesBefore + 1);
    });

    it('test_pKey_whileDraggingAShape_doesNotInterruptTheDrag', () => {
      const shape = {
        id: 'move-during-p',
        polygon: {
          outerRing: [
            { x: 1, y: 1 },
            { x: 3, y: 1 },
            { x: 3, y: 3 },
            { x: 1, y: 3 },
          ],
          innerRings: [],
        },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(shape));

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.pointerDown(node, { clientX: 40, clientY: 40 });
      fireEvent.pointerMove(node, { clientX: 80, clientY: 80 });
      fireEvent.keyDown(window, { key: 'p' });
      fireEvent.pointerUp(node, { clientX: 80, clientY: 80 });

      // The move committed normally; polygon creation never started.
      expect(editorSession.getDocument().shapes['move-during-p'].polygon.outerRing).toEqual([
        { x: 3, y: 3 },
        { x: 5, y: 3 },
        { x: 5, y: 5 },
        { x: 3, y: 5 },
      ]);
    });
  });

  describe('double-click group entry (issue #52)', () => {
    const rect = (id: string, x: number, y: number) => ({
      id,
      polygon: {
        outerRing: [
          { x, y },
          { x: x + 2, y },
          { x: x + 2, y: y + 2 },
          { x, y: y + 2 },
        ],
        innerRings: [],
      },
      style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
    });

    it('test_doubleClick_groupMember_notActive_entersGroupMode_selectsClickedMemberAlone', () => {
      editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0)));
      editorSession.dispatch(new CreateShapeCommand(rect('b', 5, 0)));
      editorSession.dispatch(new GroupShapesCommand('group-1', ['a', 'b']));

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      // Double-click inside shape 'a': grid (1,1) => px (20,20).
      fireEvent.doubleClick(node, { clientX: 20, clientY: 20 });

      expect(useSelectionStore.getState().activeGroupId).toBe('group-1');
      expect(useSelectionStore.getState().selectedIds).toEqual(['a']);
    });

    it('test_doubleClick_blankSpace_doesNothing', () => {
      editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0)));

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 2000, clientY: 2000 });

      expect(useSelectionStore.getState().activeGroupId).toBeNull();
    });

    it('test_doubleClick_ungroupedShape_doesNotEnterGroupMode', () => {
      editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0)));

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 20, clientY: 20 });

      expect(useSelectionStore.getState().activeGroupId).toBeNull();
    });

    it('test_doubleClick_memberOfAlreadyActiveGroup_staysInGroupMode_noStateChangeNeeded', () => {
      editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0)));
      editorSession.dispatch(new CreateShapeCommand(rect('b', 5, 0)));
      editorSession.dispatch(new GroupShapesCommand('group-1', ['a', 'b']));
      useSelectionStore.getState().enterGroup('group-1', ['a']);

      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      // Double-clicking 'a' again — already the entered group's member —
      // resolves to 'edit-shape' (issue #49 territory), not another
      // enter-group; group mode simply stays as it was.
      fireEvent.doubleClick(node, { clientX: 20, clientY: 20 });

      expect(useSelectionStore.getState().activeGroupId).toBe('group-1');
    });
  });

  describe('shape cell editing (issue #49)', () => {
    it('test_doubleClick_ungroupedShape_entersEditingShape_withCrosshairCursor', () => {
      editorSession.dispatch(
        new CreateShapeCommand({
          id: 'a',
          polygon: { outerRing: [
            { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
          ], innerRings: [] },
          style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
        })
      );
      const onCursorChange = vi.fn();
      const { container } = render(
        <EditorInteractionLayer {...defaultProps} onCursorChange={onCursorChange} />
      );
      const node = surface(container);

      // Double-click inside shape 'a': grid (1,1) => px (20,20).
      fireEvent.doubleClick(node, { clientX: 20, clientY: 20 });

      expect(useShapeEditPreviewStore.getState().preview?.shapeId).toBe('a');
      expect(onCursorChange).toHaveBeenLastCalledWith('crosshair');
    });

    it('test_cellDrag_addsACell_thenEnter_commitsOneCommand_growsTheShape', () => {
      const shapesBefore = editorSession.shapeCount;
      editorSession.dispatch(
        new CreateShapeCommand({
          id: 'a',
          polygon: { outerRing: [
            { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
          ], innerRings: [] },
          style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
        })
      );
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 20, clientY: 20 });
      // Cell (2,0)-(3,1) at gridSize 20 => precise point (2.5, 0.5) => px (50, 10).
      fireEvent.pointerDown(node, { clientX: 50, clientY: 10 });
      fireEvent.pointerUp(node, { clientX: 50, clientY: 10 });
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(editorSession.shapeCount).toBe(shapesBefore + 1);
      expect(editorSession.getDocument().shapes['a'].polygon.outerRing).toEqual([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ]);
      expect(useShapeEditPreviewStore.getState().preview).toBeNull();

      // One undo restores the pre-edit 1-shape geometry.
      editorSession.undo();
      expect(editorSession.getDocument().shapes['a'].polygon.outerRing).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ]);
    });

    it('test_altCellDrag_removesACellCreatingAHole_thenEnter_commitsOneShape_undoRestores', () => {
      const original = {
        id: 'a',
        polygon: { outerRing: [
          { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 },
        ], innerRings: [] },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(original));
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 30, clientY: 30 }); // inside, grid (1.5,1.5)
      // Alt-drag over the centre cell (1,1)-(2,2): precise (1.5,1.5) => px (30,30).
      fireEvent.pointerDown(node, { clientX: 30, clientY: 30, altKey: true });
      fireEvent.pointerUp(node, { clientX: 30, clientY: 30, altKey: true });
      fireEvent.keyDown(window, { key: 'Enter' });

      const document = editorSession.getDocument();
      expect(document.zOrder).toEqual(['a']);
      expect(document.shapes['a'].polygon.innerRings).toHaveLength(1);

      editorSession.undo();
      expect(editorSession.getDocument().shapes['a'].polygon).toEqual(original.polygon);
    });

    it('test_altCellDrag_disconnectsTheShape_thenEnter_splitsIntoTwoShapes_oneUndoRestoresOne', () => {
      const strip = {
        id: 'a',
        polygon: { outerRing: [
          { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 0, y: 1 },
        ], innerRings: [] },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(strip));
      const shapesBefore = editorSession.shapeCount;
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 10, clientY: 10 }); // inside, grid (0.5, 0.5)
      // Alt-drag over the middle cell (1,0)-(2,1): precise (1.5,0.5) => px (30,10).
      fireEvent.pointerDown(node, { clientX: 30, clientY: 10, altKey: true });
      fireEvent.pointerUp(node, { clientX: 30, clientY: 10, altKey: true });
      fireEvent.keyDown(window, { key: 'Enter' });

      const document = editorSession.getDocument();
      expect(document.zOrder).toHaveLength(2);
      expect(document.zOrder[0]).toBe('a');
      expect(editorSession.shapeCount).toBe(shapesBefore + 1);

      // One undo restores the single original strip.
      editorSession.undo();
      const reverted = editorSession.getDocument();
      expect(reverted.zOrder).toEqual(['a']);
      expect(reverted.shapes['a'].polygon).toEqual(strip.polygon);
    });

    it('test_altCellDrag_removingTheWholeShape_thenEnter_deletesIt_undoRestoresIt', () => {
      const shapesBefore = editorSession.shapeCount;
      const tiny = {
        id: 'a',
        polygon: { outerRing: [
          { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
        ], innerRings: [] },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(tiny));
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 10, clientY: 10 });
      fireEvent.pointerDown(node, { clientX: 10, clientY: 10, altKey: true });
      fireEvent.pointerUp(node, { clientX: 10, clientY: 10, altKey: true });
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(editorSession.getDocument().zOrder).toEqual([]);
      expect(editorSession.shapeCount).toBe(shapesBefore);

      editorSession.undo();
      const restored = editorSession.getDocument();
      expect(restored.zOrder).toEqual(['a']);
      expect(restored.shapes['a'].polygon).toEqual(tiny.polygon);
    });

    it('test_escapeKey_discardsTheEdit_documentUnchanged', () => {
      const original = {
        id: 'a',
        polygon: { outerRing: [
          { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
        ], innerRings: [] },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(original));
      const shapesBefore = editorSession.shapeCount;
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 20, clientY: 20 });
      fireEvent.pointerDown(node, { clientX: 50, clientY: 10 });
      fireEvent.pointerUp(node, { clientX: 50, clientY: 10 });
      fireEvent.keyDown(window, { key: 'Escape' });

      expect(editorSession.shapeCount).toBe(shapesBefore);
      expect(editorSession.getDocument().shapes['a'].polygon).toEqual(original.polygon);
      expect(useShapeEditPreviewStore.getState().preview).toBeNull();
    });

    it('test_whileEditing_pointerDownOnAnotherShape_doesNotSelectIt_continuesTheStroke', () => {
      const a = {
        id: 'a',
        polygon: { outerRing: [
          { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
        ], innerRings: [] },
        style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
      };
      const b = {
        id: 'b',
        polygon: { outerRing: [
          { x: 10, y: 10 }, { x: 12, y: 10 }, { x: 12, y: 12 }, { x: 10, y: 12 },
        ], innerRings: [] },
        style: { fill: '#ef4444' as const, opacity: 0.8, isBorderVisible: true },
      };
      editorSession.dispatch(new CreateShapeCommand(a));
      editorSession.dispatch(new CreateShapeCommand(b));
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 20, clientY: 20 }); // enters editing 'a'
      // Pointer down where 'b' lives — must not select it.
      fireEvent.pointerDown(node, { clientX: 220, clientY: 220 });

      expect(useSelectionStore.getState().selectedIds).not.toEqual(['b']);
      expect(useShapeEditPreviewStore.getState().preview?.shapeId).toBe('a');
    });

    it('test_pKey_whileEditingAShape_doesNotStartPolygonCreation', () => {
      editorSession.dispatch(
        new CreateShapeCommand({
          id: 'a',
          polygon: { outerRing: [
            { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
          ], innerRings: [] },
          style: { fill: '#3b82f6' as const, opacity: 0.8, isBorderVisible: true },
        })
      );
      const { container } = render(<EditorInteractionLayer {...defaultProps} />);
      const node = surface(container);

      fireEvent.doubleClick(node, { clientX: 20, clientY: 20 });
      fireEvent.keyDown(window, { key: 'p' });

      // Still editing the shape — P did not interrupt it or start a polygon.
      expect(useShapeEditPreviewStore.getState().preview?.shapeId).toBe('a');
    });
  });
});
