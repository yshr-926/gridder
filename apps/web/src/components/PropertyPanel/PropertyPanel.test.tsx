import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, GroupShapesCommand, type EditorShape } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { useSelectionStore } from '@/stores/selectionStore';
import { PropertyPanel } from './PropertyPanel';

const makeRect = (id: string, span: number): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: span, y: 0 },
      { x: span, y: 2 },
      { x: 0, y: 2 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const resetEditor = () => {
  // Undo everything this test file dispatched so the singleton starts clean.
  // Wrapped in act: the previous test's PropertyPanel may still be mounted
  // when this runs in afterEach, so the resulting re-render must be flushed
  // inside React's test harness.
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    useSelectionStore.getState().clear();
  });
};

describe('PropertyPanel', () => {
  beforeEach(resetEditor);
  afterEach(resetEditor);

  it('test_PropertyPanel_noSelection_rendersNothing', () => {
    render(<PropertyPanel />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('test_PropertyPanel_singleSelection_showsNameDimensionsAndAppearance', () => {
    const shape = makeRect('shape-1', 4);
    editorSession.dispatch(new CreateShapeCommand(shape));
    useSelectionStore.getState().selectOnly('shape-1');

    render(<PropertyPanel />);

    expect(
      screen.getByRole('complementary', { name: '図形インスペクター' }),
    ).toBeInTheDocument();
    expect(screen.getByText('選択中の図形')).toBeInTheDocument();
    // Name field.
    expect(screen.getByLabelText('名前')).toBeInTheDocument();
    // Dimensions: no physical scale -> cell counts.
    expect(screen.getByText('幅')).toBeInTheDocument();
    expect(screen.getByText('4 セル')).toBeInTheDocument();
    expect(screen.getByText('2 セル')).toBeInTheDocument();
    // Appearance.
    expect(screen.getByRole('group', { name: '塗り色' })).toBeInTheDocument();
    expect(screen.getByLabelText('透明度')).toBeInTheDocument();
    expect(screen.getByLabelText('境界線を表示')).toBeInTheDocument();
  });

  it('test_PropertyPanel_multiSelection_showsCommonAppearanceOnly', () => {
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-1', 4)));
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-2', 6)));
    useSelectionStore.getState().setSelection(['shape-1', 'shape-2']);

    render(<PropertyPanel />);

    expect(screen.getByText('2 図形を選択中')).toBeInTheDocument();
    // Common appearance controls stay.
    expect(screen.getByRole('group', { name: '塗り色' })).toBeInTheDocument();
    expect(screen.getByLabelText('境界線を表示')).toBeInTheDocument();
    // Single-only controls are gone.
    expect(screen.queryByLabelText('名前')).not.toBeInTheDocument();
    expect(screen.queryByText('寸法')).not.toBeInTheDocument();
  });

  it('test_PropertyPanel_wholeGroupSelected_showsGroupHeading_andCommonAppearanceOnly', () => {
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-1', 4)));
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-2', 6)));
    editorSession.dispatch(new GroupShapesCommand('group-1', ['shape-1', 'shape-2']));
    useSelectionStore.getState().setSelection(['shape-1', 'shape-2']);

    render(<PropertyPanel />);

    expect(screen.getByText('グループを選択中')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '塗り色' })).toBeInTheDocument();
    expect(screen.queryByLabelText('名前')).not.toBeInTheDocument();
  });

  it('test_PropertyPanel_renameOnEnter_dispatchesCommand_andIsUndoable', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-1', 4)));
    useSelectionStore.getState().selectOnly('shape-1');

    render(<PropertyPanel />);

    const input = screen.getByLabelText('名前');
    await user.type(input, '玄関');
    await user.keyboard('{Enter}');

    expect(editorSession.getDocument().shapes['shape-1'].name).toBe('玄関');

    act(() => {
      editorSession.undo();
    });
    expect(editorSession.getDocument().shapes['shape-1'].name).toBeUndefined();
  });

  it('test_PropertyPanel_fillSwatch_dispatchesStyleCommand_forEverySelectedShape', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-1', 4)));
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-2', 6)));
    useSelectionStore.getState().setSelection(['shape-1', 'shape-2']);

    render(<PropertyPanel />);

    const palette = screen.getByRole('group', { name: '塗り色' });
    await user.click(within(palette).getByRole('button', { name: '塗り色を #ef4444 に変更' }));

    expect(editorSession.getDocument().shapes['shape-1'].style.fill).toBe('#ef4444');
    expect(editorSession.getDocument().shapes['shape-2'].style.fill).toBe('#ef4444');

    // One composite entry -> one Undo reverts both.
    act(() => {
      editorSession.undo();
    });
    expect(editorSession.getDocument().shapes['shape-1'].style.fill).toBe('#3b82f6');
    expect(editorSession.getDocument().shapes['shape-2'].style.fill).toBe('#3b82f6');
  });

  it('test_PropertyPanel_borderToggle_dispatchesStyleCommand', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-1', 4)));
    useSelectionStore.getState().selectOnly('shape-1');

    render(<PropertyPanel />);

    await user.click(screen.getByLabelText('境界線を表示'));
    expect(editorSession.getDocument().shapes['shape-1'].style.isBorderVisible).toBe(false);

    act(() => {
      editorSession.undo();
    });
    expect(editorSession.getDocument().shapes['shape-1'].style.isBorderVisible).toBe(true);
  });

  it('test_PropertyPanel_rotateCwButton_dispatchesRotateCommand_singleSelection', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-1', 4)));
    useSelectionStore.getState().selectOnly('shape-1');

    render(<PropertyPanel />);
    await user.click(screen.getByRole('button', { name: '時計回りに90度回転' }));

    expect(editorSession.getDocument().shapes['shape-1'].polygon.outerRing).toEqual([
      { x: 2, y: 0 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ]);

    act(() => {
      editorSession.undo();
    });
    expect(editorSession.getDocument().shapes['shape-1'].polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ]);
  });

  it('test_PropertyPanel_rotateCcwButton_dispatchesRotateCommand_multiSelection', async () => {
    const user = userEvent.setup();
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-1', 4)));
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-2', 6)));
    useSelectionStore.getState().setSelection(['shape-1', 'shape-2']);

    render(<PropertyPanel />);
    await user.click(screen.getByRole('button', { name: '反時計回りに90度回転' }));

    // One Command for the whole selection -> one Undo step reverts both.
    act(() => {
      editorSession.undo();
    });
    expect(editorSession.getDocument().shapes['shape-1'].polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(editorSession.getDocument().shapes['shape-2'].polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 2 },
      { x: 0, y: 2 },
    ]);
  });

  it('test_PropertyPanel_dropsSelectedIdsWithNoMatchingShape', () => {
    editorSession.dispatch(new CreateShapeCommand(makeRect('shape-1', 4)));
    // 'ghost' has no shape in the document (e.g. just deleted).
    useSelectionStore.getState().setSelection(['shape-1', 'ghost']);

    render(<PropertyPanel />);

    // Only the real shape counts, so this is a single selection.
    expect(screen.getByText('選択中の図形')).toBeInTheDocument();
    expect(screen.getByLabelText('名前')).toBeInTheDocument();
  });
});
