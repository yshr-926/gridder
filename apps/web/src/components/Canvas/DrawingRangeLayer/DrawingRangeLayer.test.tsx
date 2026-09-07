import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { DrawingRangeLayer } from './DrawingRangeLayer';
import { editorSession } from '@/features/editor';
import { useSelectionStore } from '@/stores/selectionStore';

/**
 * Mock react-konva the same way `EditorInteractionLayer.test.tsx` does: real
 * DOM nodes carrying the Konva props as data attributes, with pointer
 * handlers wired through a `getStage().getPointerPosition()` shim so a test
 * can drive a drag in grid space (gridSize 20, scale 1, offset {0,0} unless a
 * test overrides them).
 */
vi.mock('react-konva', () => ({
  Group: ({
    children,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    ...props
  }: { children?: React.ReactNode } & Record<string, unknown>) => {
    const makeEvent = (e: { clientX?: number; clientY?: number }) => ({
      target: {
        getStage: () => ({
          getPointerPosition: () => ({ x: e.clientX ?? 0, y: e.clientY ?? 0 }),
          container: () => ({ style: { cursor: '', setProperty: () => {} } }),
        }),
      },
    });
    return (
      <div
        data-testid="konva-group"
        onPointerMove={
          onPointerMove
            ? (e) => (onPointerMove as (ev: unknown) => void)(makeEvent(e as unknown as { clientX: number; clientY: number }))
            : undefined
        }
        onPointerUp={
          onPointerUp
            ? (e) => (onPointerUp as (ev: unknown) => void)(makeEvent(e as unknown as { clientX: number; clientY: number }))
            : undefined
        }
        onPointerLeave={onPointerCancel ? () => (onPointerCancel as () => void)() : undefined}
        {...props}
      >
        {children}
      </div>
    );
  },
  Rect: ({ name, onPointerDown, onPointerEnter, onPointerLeave, ...props }: Record<string, unknown>) => {
    const makeEvent = (e: { clientX?: number; clientY?: number }) => ({
      target: {
        getStage: () => ({
          getPointerPosition: () => ({ x: e.clientX ?? 0, y: e.clientY ?? 0 }),
          container: () => ({ style: { cursor: '' } }),
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
            ? (e) => (onPointerDown as (ev: unknown) => void)(makeEvent(e as unknown as { clientX: number; clientY: number }))
            : undefined
        }
        onPointerEnter={onPointerEnter ? () => (onPointerEnter as (ev: unknown) => void)(makeEvent({})) : undefined}
        onPointerLeave={onPointerLeave ? () => (onPointerLeave as (ev: unknown) => void)(makeEvent({})) : undefined}
      />
    );
  },
}));

const rectShape = (id: string, minX: number, minY: number, maxX: number, maxY: number): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const defaultProps = { gridSize: 20, scale: 1 };

const reset = () => {
  // Wrapped in act: a previous test's DrawingRangeLayer may still be mounted
  // when this runs in afterEach, so the resulting re-render must be flushed
  // inside React's test harness.
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useSelectionStore.setState({ selectedIds: [], primaryId: null });
  });
};

describe('DrawingRangeLayer', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_DrawingRangeLayer_autoMode_noShapes_rendersNothing', () => {
    const { queryByTestId } = render(<DrawingRangeLayer {...defaultProps} />);
    expect(queryByTestId('konva-group')).toBeNull();
  });

  it('test_DrawingRangeLayer_autoMode_withShapes_drawsFrameAroundBoundingBox', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 1, 1, 4, 3)));
    const { container } = render(<DrawingRangeLayer {...defaultProps} />);
    const frames = container.querySelectorAll('[data-name="drawing-range-frame"]');
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute('data-x')).toBe(String(1 * 20));
    expect(frames[0].getAttribute('data-y')).toBe(String(1 * 20));
    expect(frames[0].getAttribute('data-width')).toBe(String((4 - 1) * 20));
    expect(frames[0].getAttribute('data-height')).toBe(String((3 - 1) * 20));
  });

  it('test_DrawingRangeLayer_noSelection_rendersEightHandles', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 4, 4)));
    const { container } = render(<DrawingRangeLayer {...defaultProps} />);
    const handles = container.querySelectorAll('[data-name^="drawing-range-handle-"]');
    expect(handles).toHaveLength(8);
  });

  it('test_DrawingRangeLayer_withSelection_hidesHandles_butKeepsFrame', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 4, 4)));
    useSelectionStore.setState({ selectedIds: ['a'], primaryId: 'a' });
    const { container } = render(<DrawingRangeLayer {...defaultProps} />);
    expect(container.querySelectorAll('[data-name^="drawing-range-handle-"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-name="drawing-range-frame"]')).toHaveLength(1);
  });

  it('test_DrawingRangeLayer_dragCornerHandle_previewsThenCommitsManualBounds_onPointerUp', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 4, 4)));
    const { container } = render(<DrawingRangeLayer {...defaultProps} />);

    const seHandle = container.querySelector('[data-name="drawing-range-handle-se"]') as HTMLElement;
    expect(seHandle).not.toBeNull();

    fireEvent.pointerDown(seHandle, { clientX: 80, clientY: 80 }); // grid (4,4), no change yet
    const group = container.querySelector('[data-testid="konva-group"]') as HTMLElement;

    // Drag the SE corner out to grid (8, 6) => px (160, 120).
    fireEvent.pointerMove(group, { clientX: 160, clientY: 120 });

    // Document is untouched during the drag (Konva-only preview).
    expect(editorSession.getDocument().drawingBounds.mode).toBe('auto');

    fireEvent.pointerUp(group, { clientX: 160, clientY: 120 });

    const bounds = editorSession.getDocument().drawingBounds;
    expect(bounds).toEqual({ mode: 'manual', min: { x: 0, y: 0 }, max: { x: 8, y: 6 } });
  });

  it('test_DrawingRangeLayer_manualDrag_isUndoable', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 4, 4)));
    const { container } = render(<DrawingRangeLayer {...defaultProps} />);

    const seHandle = container.querySelector('[data-name="drawing-range-handle-se"]') as HTMLElement;
    const group = container.querySelector('[data-testid="konva-group"]') as HTMLElement;

    fireEvent.pointerDown(seHandle, { clientX: 80, clientY: 80 });
    fireEvent.pointerMove(group, { clientX: 160, clientY: 120 });
    fireEvent.pointerUp(group, { clientX: 160, clientY: 120 });

    expect(editorSession.getDocument().drawingBounds.mode).toBe('manual');

    act(() => {
      editorSession.undo();
    });

    expect(editorSession.getDocument().drawingBounds.mode).toBe('auto');
  });
});
