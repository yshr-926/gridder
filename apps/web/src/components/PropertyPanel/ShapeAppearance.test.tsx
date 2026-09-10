import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { useOpacityPreviewStore } from '@/stores/opacityPreviewStore';
import { ShapeAppearance } from './ShapeAppearance';

const rectShape = (id: string, opacity: number): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 0, y: 2 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity, isBorderVisible: true },
});

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useOpacityPreviewStore.getState().clearPreview();
  });
};

/** The shapes the panel would be handed, resolved from the live document. */
const documentShapes = (ids: readonly string[]): readonly EditorShape[] => {
  const document = editorSession.getDocument();
  return ids
    .map((id) => document.shapes[id])
    .filter((shape): shape is EditorShape => shape !== undefined);
};

describe('ShapeAppearance', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_opacitySliderDrag_commitsOneCommandOnRelease', async () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0.7)));
    const depthBefore = editorSession.undoDepth;

    render(<ShapeAppearance shapes={documentShapes(['a'])} />);
    const slider = screen.getByLabelText('透明度');

    // 70 → 60 → 50 in one drag.
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '60' } });
    fireEvent.change(slider, { target: { value: '50' } });
    expect(editorSession.undoDepth).toBe(depthBefore);
    expect(useOpacityPreviewStore.getState().preview).toEqual({
      shapeIds: ['a'],
      opacity: 0.5,
    });

    fireEvent.pointerUp(slider);

    expect(editorSession.undoDepth).toBe(depthBefore + 1);
    expect(editorSession.getDocument().shapes['a']?.style.opacity).toBe(0.5);
    expect(useOpacityPreviewStore.getState().preview).toBeNull();
  });

  it('test_opacitySliderDrag_undoOnce_restoresTheOriginalOpacity', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0.7)));

    render(<ShapeAppearance shapes={documentShapes(['a'])} />);
    const slider = screen.getByLabelText('透明度');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '60' } });
    fireEvent.change(slider, { target: { value: '50' } });
    fireEvent.pointerUp(slider);

    act(() => {
      editorSession.undo();
    });

    expect(editorSession.getDocument().shapes['a']?.style.opacity).toBe(0.7);
  });

  it('test_opacityStepButton_commitsImmediately', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0.7)));
    const depthBefore = editorSession.undoDepth;

    render(<ShapeAppearance shapes={documentShapes(['a'])} />);
    await user.click(screen.getByRole('button', { name: '透明度を下げる' }));

    expect(editorSession.undoDepth).toBe(depthBefore + 1);
    expect(editorSession.getDocument().shapes['a']?.style.opacity).toBeCloseTo(0.65);
  });

  it('test_opacitySliderDrag_multiSelection_isOneUndoStep', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0.7)));
    editorSession.dispatch(new CreateShapeCommand(rectShape('b', 0.7)));
    const depthBefore = editorSession.undoDepth;

    render(<ShapeAppearance shapes={documentShapes(['a', 'b'])} />);
    const slider = screen.getByLabelText('透明度');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '40' } });
    fireEvent.pointerUp(slider);

    expect(editorSession.undoDepth).toBe(depthBefore + 1);
    const shapes = editorSession.getDocument().shapes;
    expect(shapes['a']?.style.opacity).toBe(0.4);
    expect(shapes['b']?.style.opacity).toBe(0.4);
  });

  it('test_opacityChange_withoutAPointerGesture_commitsImmediately', () => {
    // An arrow key or a programmatic set is already a complete interaction:
    // it must not wait for a release event that never arrives.
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0.7)));
    const depthBefore = editorSession.undoDepth;

    render(<ShapeAppearance shapes={documentShapes(['a'])} />);
    fireEvent.change(screen.getByLabelText('透明度'), { target: { value: '50' } });

    expect(editorSession.undoDepth).toBe(depthBefore + 1);
    expect(editorSession.getDocument().shapes['a']?.style.opacity).toBe(0.5);
    expect(useOpacityPreviewStore.getState().preview).toBeNull();
  });

  it('test_dragThenBlurWithoutPointerUp_stillCommits', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0.7)));
    const depthBefore = editorSession.undoDepth;

    render(<ShapeAppearance shapes={documentShapes(['a'])} />);
    const slider = screen.getByLabelText('透明度');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '20' } });
    fireEvent.blur(slider);

    expect(editorSession.undoDepth).toBe(depthBefore + 1);
    expect(editorSession.getDocument().shapes['a']?.style.opacity).toBe(0.2);
  });

  it('test_unmountMidDrag_clearsThePreview', () => {
    editorSession.dispatch(new CreateShapeCommand(rectShape('a', 0.7)));

    const view = render(<ShapeAppearance shapes={documentShapes(['a'])} />);
    const slider = screen.getByLabelText('透明度');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '30' } });
    expect(useOpacityPreviewStore.getState().preview).not.toBeNull();

    view.unmount();

    expect(useOpacityPreviewStore.getState().preview).toBeNull();
  });
});
