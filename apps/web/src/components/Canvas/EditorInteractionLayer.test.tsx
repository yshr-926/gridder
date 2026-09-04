import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CreateShapeCommand } from '@gridder/editor-core';
import { EditorInteractionLayer } from './EditorInteractionLayer';
import { editorSession } from '@/features/editor';
import { useSelectionStore } from '@/stores/selectionStore';
import { useMovePreviewStore } from '@/stores/movePreviewStore';

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
    ...props
  }: Record<string, unknown>) => {
    const makeEvent = (e: { clientX?: number; clientY?: number; shiftKey?: boolean }) => ({
      evt: { shiftKey: e.shiftKey ?? false },
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
                  makeEvent(e as unknown as { clientX: number; clientY: number; shiftKey: boolean })
                )
            : undefined
        }
        onPointerMove={
          onPointerMove
            ? (e) =>
                (onPointerMove as (ev: unknown) => void)(
                  makeEvent(e as unknown as { clientX: number; clientY: number; shiftKey: boolean })
                )
            : undefined
        }
        onPointerUp={
          onPointerUp
            ? (e) =>
                (onPointerUp as (ev: unknown) => void)(
                  makeEvent(e as unknown as { clientX: number; clientY: number; shiftKey: boolean })
                )
            : undefined
        }
        onPointerCancel={
          onPointerCancel ? () => (onPointerCancel as () => void)() : undefined
        }
      />
    );
  },
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
    useSelectionStore.setState({ selectedIds: [], primaryId: null });
    useMovePreviewStore.setState({ preview: null });
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
});
