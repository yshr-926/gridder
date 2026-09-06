import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { useSettingsStore } from '@/stores';
import { useToastStore } from '@/hooks';
import { SharePanel } from './SharePanel';

/**
 * Mock react-konva the same way `ExportStage.test.tsx` does — `SharePanel`
 * always mounts an `ExportStage` once there is content, so its Popover tests
 * need the same stand-in Konva scene graph.
 */
vi.mock('react-konva', async () => {
  const React = await import('react');
  const MockStage = React.forwardRef(
    (
      { width, height, children }: { width: number; height: number; children?: React.ReactNode },
      ref: React.Ref<{ toDataURL: (opts: Record<string, unknown>) => string }>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        toDataURL: (opts: Record<string, unknown>) =>
          `data:fake;w=${width};h=${height};${JSON.stringify(opts)}`,
      }));
      return React.createElement(
        'div',
        { 'data-testid': 'konva-stage', 'data-width': String(width), 'data-height': String(height) },
        children,
      );
    },
  );

  const passthrough =
    (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': testId }, children);

  return {
    Stage: MockStage,
    Layer: passthrough('konva-layer'),
    Group: passthrough('konva-group'),
    Rect: () => React.createElement('div', { 'data-testid': 'konva-rect' }),
    Line: () => React.createElement('div', { 'data-testid': 'konva-line' }),
    Text: () => React.createElement('div', { 'data-testid': 'konva-text' }),
    Shape: () => React.createElement('div', { 'data-testid': 'konva-shape' }),
  };
});

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
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
    useSettingsStore.setState({
      includeDimensionsInShareImage: true,
      includeGridInShareImage: true,
    });
    useToastStore.setState({ toasts: [] });
  });
};

const openPanel = async () => {
  const user = userEvent.setup();
  render(<SharePanel />);
  await user.click(screen.getByRole('button', { name: '共有' }));
  return user;
};

describe('SharePanel', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_SharePanel_trigger_hasAccessibleName', () => {
    render(<SharePanel />);
    expect(screen.getByRole('button', { name: '共有' })).toBeInTheDocument();
  });

  it('test_SharePanel_noShapes_exportButtonDisabled_withExplanation', async () => {
    await openPanel();
    expect(screen.getByRole('button', { name: '書き出す' })).toBeDisabled();
    expect(screen.getByText('図形がないため書き出せません。')).toBeInTheDocument();
  });

  it('test_SharePanel_defaultFormat_isPng_andQualitySliderHidden', async () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    await openPanel();

    expect(screen.getByRole('button', { name: 'PNG' })).toHaveAttribute('data-pressed', '');
    expect(screen.queryByLabelText('JPEG 品質')).not.toBeInTheDocument();
  });

  it('test_SharePanel_switchingToJpeg_showsQualitySlider', async () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    const user = await openPanel();

    await user.click(screen.getByRole('button', { name: 'JPEG' }));

    expect(screen.getByLabelText('JPEG 品質')).toBeInTheDocument();
  });

  it('test_SharePanel_includeGridCheckbox_reflectsAndUpdatesSettingsStore', async () => {
    const user = await openPanel();

    const checkbox = screen.getByLabelText('グリッドを含める');
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(useSettingsStore.getState().includeGridInShareImage).toBe(false);
  });

  it('test_SharePanel_includeDimensionsCheckbox_reflectsAndUpdatesSettingsStore', async () => {
    const user = await openPanel();

    const checkbox = screen.getByLabelText('寸法を含める');
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(useSettingsStore.getState().includeDimensionsInShareImage).toBe(false);
  });

  it('test_SharePanel_export_downloadsFile_andShowsSuccessToast', async () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    const user = await openPanel();

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await user.click(screen.getByRole('button', { name: '書き出す' }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
      '共有画像を書き出しました',
    );

    clickSpy.mockRestore();
  });

  it('test_SharePanel_export_setsAnchorDownloadName_withFormatExtension', async () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    const user = await openPanel();

    let downloadName: string | null = null;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadName = this.download;
      });

    await user.click(screen.getByRole('button', { name: '書き出す' }));

    expect(downloadName).toMatch(/\.png$/);
    clickSpy.mockRestore();
  });
});
