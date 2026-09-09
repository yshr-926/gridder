import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { useSettingsStore } from '@/stores';
import { useToastStore } from '@/hooks';
import { SharePanel } from './SharePanel';

/**
 * Mock react-konva the same way `ExportStage.test.tsx` does — `SharePanel`
 * mounts a preview `ExportStage` while open (issue #67), so its Popover
 * tests need the same stand-in Konva scene graph. `Layer.toBlob` resolves to
 * a small Blob so the export path runs end to end.
 */
vi.mock('react-konva', async () => {
  const React = await import('react');
  const MockStage = ({
    width,
    height,
    scaleX,
    children,
  }: {
    width: number;
    height: number;
    scaleX?: number;
    children?: React.ReactNode;
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'konva-stage',
        'data-width': String(width),
        'data-height': String(height),
        'data-scale-x': String(scaleX ?? ''),
      },
      children,
    );
  const MockLayer = React.forwardRef(
    (
      { children }: { children?: React.ReactNode },
      ref: React.Ref<{ toBlob: (opts: Record<string, unknown>) => Promise<Blob> }>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        toBlob: () => Promise.resolve(new Blob(['fake'], { type: 'image/png' })),
      }));
      return React.createElement('div', { 'data-testid': 'konva-layer' }, children);
    },
  );

  const passthrough =
    (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': testId }, children);

  return {
    Stage: MockStage,
    Layer: MockLayer,
    Group: passthrough('konva-group'),
    Rect: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-testid': 'konva-rect',
        'data-name': String(props.name ?? ''),
      }),
    Line: () => React.createElement('div', { 'data-testid': 'konva-line' }),
    Text: () => React.createElement('div', { 'data-testid': 'konva-text' }),
    Shape: () => React.createElement('div', { 'data-testid': 'konva-shape' }),
  };
});

const rectShape = (id: string, width = 4, height = 3): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

/**
 * jsdom has no `URL.createObjectURL` / `revokeObjectURL`; `downloadBlob`
 * needs both. Installed for the whole file and removed afterwards.
 */
const installObjectUrl = () => {
  const url = URL as unknown as Record<string, unknown>;
  const previous = { create: url.createObjectURL, revoke: url.revokeObjectURL };
  url.createObjectURL = vi.fn(() => 'blob:mock');
  url.revokeObjectURL = vi.fn();
  return () => {
    url.createObjectURL = previous.create;
    url.revokeObjectURL = previous.revoke;
  };
};

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

const addShape = (shape: EditorShape) => {
  act(() => {
    editorSession.dispatch(new CreateShapeCommand(shape));
  });
};

const outputSizeText = () => screen.getByTestId('share-image-output-size').textContent;

describe('SharePanel', () => {
  let restoreObjectUrl: () => void = () => {};
  beforeEach(() => {
    reset();
    restoreObjectUrl = installObjectUrl();
  });
  afterEach(() => {
    restoreObjectUrl();
    reset();
  });

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

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(downloadName).toMatch(/\.png$/));
    clickSpy.mockRestore();
  });

  it('test_SharePanel_closed_doesNotMountPreviewStage_issue67', () => {
    addShape(rectShape('a'));
    render(<SharePanel />);
    expect(screen.queryByTestId('konva-stage')).not.toBeInTheDocument();
  });

  it('test_SharePanel_open_mountsPreviewStage_scaledToFitPreviewBox_issue67', async () => {
    // 100 × 20 cells at 20 px = 2000 × 400 px → fits the 288-px-wide box at 0.144.
    addShape(rectShape('a', 100, 20));
    await openPanel();
    const stage = screen.getByTestId('konva-stage');
    expect(Number(stage.getAttribute('data-scale-x'))).toBeCloseTo(0.144);
    expect(Number(stage.getAttribute('data-width'))).toBeCloseTo(288);
  });

  it('test_SharePanel_showsOutputSize_forDefault2x_issue67', async () => {
    addShape(rectShape('a')); // 4 × 3 cells at 20 px → 80 × 60 at 1x.
    await openPanel();
    expect(outputSizeText()).toBe('160 × 120 px');
  });

  it('test_SharePanel_scaleToggle_updatesOutputSize_issue67', async () => {
    addShape(rectShape('a'));
    const user = await openPanel();
    await user.click(screen.getByRole('button', { name: '3x' }));
    expect(outputSizeText()).toBe('240 × 180 px');
  });

  it('test_SharePanel_marginToggle_growsOutputSizeByWholeCells_issue67', async () => {
    addShape(rectShape('a'));
    const user = await openPanel();
    await user.click(screen.getByRole('button', { name: '中' }));
    // (4 + 2·2) × (3 + 2·2) cells at 20 px × 2 = 320 × 280.
    expect(outputSizeText()).toBe('320 × 280 px');
  });

  it('test_SharePanel_overSizeLimit_disablesScaleOptionsAndExport_issue67', async () => {
    // 400 × 400 cells at 20 px = 8000 × 8000 at 1x (64 MP, allowed); 2x is 256 MP.
    addShape(rectShape('a', 400, 400));
    const user = await openPanel();

    expect(screen.getByRole('button', { name: '1x' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '2x' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '3x' })).toBeDisabled();
    // The default 2x is over the limit, so the export is blocked with an explanation.
    expect(screen.getByRole('button', { name: '書き出す' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('上限');

    await user.click(screen.getByRole('button', { name: '1x' }));
    expect(screen.getByRole('button', { name: '書き出す' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('test_SharePanel_transparentBackground_omitsBackgroundRect_issue67', async () => {
    addShape(rectShape('a'));
    const user = await openPanel();
    expect(screen.getByTestId('konva-rect')).toHaveAttribute('data-name', 'share-image-background');

    await user.click(screen.getByRole('button', { name: '透明' }));

    expect(screen.queryByTestId('konva-rect')).not.toBeInTheDocument();
  });

  it('test_SharePanel_jpeg_disablesTransparent_paintsWhite_andRestoresOnPng_issue67', async () => {
    addShape(rectShape('a'));
    const user = await openPanel();
    await user.click(screen.getByRole('button', { name: '透明' }));

    await user.click(screen.getByRole('button', { name: 'JPEG' }));
    expect(screen.getByRole('button', { name: '透明' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '白' })).toHaveAttribute('data-pressed', '');
    expect(screen.getByTestId('konva-rect')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'PNG' }));
    expect(screen.getByRole('button', { name: '透明' })).toHaveAttribute('data-pressed', '');
    expect(screen.queryByTestId('konva-rect')).not.toBeInTheDocument();
  });

  it('test_SharePanel_choicesSurviveClosingAndReopening_issue67', async () => {
    addShape(rectShape('a'));
    const user = await openPanel();
    await user.click(screen.getByRole('button', { name: '3x' }));
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '書き出す' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: '共有' }));
    expect(screen.getByRole('button', { name: '3x' })).toHaveAttribute('data-pressed', '');
  });
});
