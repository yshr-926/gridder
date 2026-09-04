import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { EditorInteractionLayer } from './EditorInteractionLayer';
import { editorSession } from '@/features/editor';
import { useSelectionStore } from '@/stores/selectionStore';

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
});
