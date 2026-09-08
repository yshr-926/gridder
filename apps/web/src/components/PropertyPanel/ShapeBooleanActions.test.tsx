import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { useSelectionStore } from '@/stores/selectionStore';
import { useToastStore } from '@/hooks/useToast';
import { ShapeBooleanActions } from './ShapeBooleanActions';

const rect = (id: string, minX: number, minY: number, maxX: number, maxY: number): EditorShape => ({
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

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useSelectionStore.getState().clear();
    useToastStore.setState({ toasts: [] });
  });
};

describe('ShapeBooleanActions', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_combineButton_unionsTheSelectionIntoOneShape', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0, 3, 3)));
    editorSession.dispatch(new CreateShapeCommand(rect('b', 3, 0, 4, 1)));
    useSelectionStore.getState().setSelection(['a', 'b']);

    render(<ShapeBooleanActions />);
    await user.click(screen.getByRole('button', { name: '結合' }));

    expect(editorSession.getDocument().zOrder).toEqual(['b']);
    expect(editorSession.getDocument().shapes['b'].polygon.outerRing).toHaveLength(6);
  });

  it('test_combineButton_separatedShapes_showsErrorToast_leavesDocument', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rect('a', 0, 0, 3, 3)));
    editorSession.dispatch(new CreateShapeCommand(rect('b', 5, 0, 8, 3)));
    useSelectionStore.getState().setSelection(['a', 'b']);

    render(<ShapeBooleanActions />);
    await user.click(screen.getByRole('button', { name: '結合' }));

    expect(editorSession.getDocument().zOrder).toEqual(['a', 'b']);
    expect(useToastStore.getState().toasts[0]?.type).toBe('error');
  });

  it('test_subtractButton_carvesTheFrontmostOutOfTheOthers', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(rect('subject', 0, 0, 4, 4)));
    editorSession.dispatch(new CreateShapeCommand(rect('cutter', 1, 1, 2, 2)));
    useSelectionStore.getState().setSelection(['subject', 'cutter']);

    render(<ShapeBooleanActions />);
    await user.click(screen.getByRole('button', { name: 'くり抜き' }));

    const document = editorSession.getDocument();
    expect(document.zOrder).toEqual(['subject']);
    expect(document.shapes['subject'].polygon.innerRings).toHaveLength(1);
  });
});
