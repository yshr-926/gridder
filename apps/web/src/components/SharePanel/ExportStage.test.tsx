import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import { ExportStage, type ExportStageHandle } from './ExportStage';
import type { ExportCropRect } from '@/features/export-image';

/**
 * Mock react-konva so a plain DOM tree stands in for the Konva scene graph.
 * `Stage` records the props it was constructed with (`width`/`height`) and
 * exposes a `toDataURL` on its ref that returns a fake data URL carrying
 * those dimensions and the call's own options — enough for the crop-size and
 * mimeType/quality/pixelRatio assertions below without a real canvas.
 *
 * `vi.mock`'s factory is hoisted above every import, so it cannot close over
 * a top-level `const` (a temporal-dead-zone `ReferenceError` at that hoisted
 * call site) — `await import('react')` inside the (async) factory itself
 * sidesteps that without a `require()`.
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

  return {
    Stage: MockStage,
    Layer: ({
      children,
      x,
      y,
      listening,
    }: Record<string, unknown> & { children?: React.ReactNode }) => (
      <div
        data-testid="konva-layer"
        data-x={String(x ?? '')}
        data-y={String(y ?? '')}
        data-listening={String(listening ?? '')}
      >
        {children}
      </div>
    ),
    Group: ({
      children,
      name,
      x,
      y,
    }: { children?: React.ReactNode } & Record<string, unknown>) => (
      <div
        data-testid="konva-group"
        data-name={String(name ?? '')}
        data-x={String(x ?? '')}
        data-y={String(y ?? '')}
      >
        {children}
      </div>
    ),
    Rect: (props: Record<string, unknown>) => (
      <div
        data-testid="konva-rect"
        data-name={String(props.name ?? '')}
        data-fill={String(props.fill ?? '')}
      />
    ),
    Line: (props: Record<string, unknown>) => (
      <div data-testid="konva-line" data-name={String(props.name ?? '')} />
    ),
    Text: (props: Record<string, unknown>) => (
      <div
        data-testid="konva-text"
        data-name={String(props.name ?? '')}
        data-text={String(props.text ?? '')}
      />
    ),
    Shape: (props: Record<string, unknown>) => (
      <div data-testid="konva-shape" data-name={String(props.name ?? '')} />
    ),
  };
});

const rectRing = (x: number, y: number, w: number, h: number): GridRing => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const rectShape = (id: string, x: number, y: number, w: number, h: number): EditorShape => ({
  id,
  polygon: { outerRing: rectRing(x, y, w, h), innerRings: [] },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
  name: id,
});

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

const cropRect: ExportCropRect = { x: 20, y: 10, width: 200, height: 120 };

describe('ExportStage', () => {
  it('test_ExportStage_sizesStageToCropRect', () => {
    const document = documentOf([rectShape('a', 1, 1, 4, 3)]);
    const { getByTestId } = render(
      <ExportStage
        document={document}
        gridSize={20}
        cropRect={cropRect}
        includeGrid={false}
        includeDimensions={false}
      />,
    );
    const stage = getByTestId('konva-stage');
    expect(stage.getAttribute('data-width')).toBe('200');
    expect(stage.getAttribute('data-height')).toBe('120');
  });

  it('test_ExportStage_offsetsLayers_byNegativeCropOrigin', () => {
    const document = documentOf([rectShape('a', 1, 1, 4, 3)]);
    const { getAllByTestId } = render(
      <ExportStage
        document={document}
        gridSize={20}
        cropRect={cropRect}
        includeGrid={false}
        includeDimensions={false}
      />,
    );
    const layers = getAllByTestId('konva-layer');
    // Every content layer (all but the white-background one) is offset by -cropRect.x/-y.
    const offsetLayers = layers.filter((el) => el.getAttribute('data-x') === '-20');
    expect(offsetLayers.length).toBeGreaterThan(0);
    for (const layer of offsetLayers) {
      expect(layer.getAttribute('data-y')).toBe('-10');
    }
  });

  it('test_ExportStage_paintsWhiteBackground_beforeAnyOtherLayer', () => {
    const document = documentOf([]);
    const { getByTestId } = render(
      <ExportStage
        document={document}
        gridSize={20}
        cropRect={cropRect}
        includeGrid={false}
        includeDimensions={false}
      />,
    );
    expect(getByTestId('konva-rect').getAttribute('data-fill')).toBe('#ffffff');
  });

  it('test_ExportStage_includeGridFalse_omitsGridBackgroundLayer', () => {
    const document = documentOf([]);
    const { queryByTestId } = render(
      <ExportStage
        document={document}
        gridSize={20}
        cropRect={cropRect}
        includeGrid={false}
        includeDimensions={false}
      />,
    );
    // With no grid and no shapes, only the background Rect should appear.
    expect(queryByTestId('konva-line')).toBeNull();
  });

  it('test_ExportStage_includeGridTrue_rendersGridLines', () => {
    const document = documentOf([]);
    const { queryAllByTestId } = render(
      <ExportStage
        document={document}
        gridSize={20}
        cropRect={cropRect}
        includeGrid={true}
        includeDimensions={false}
      />,
    );
    expect(queryAllByTestId('konva-line').length).toBeGreaterThan(0);
  });

  it('test_ExportStage_includeDimensionsTrue_annotatesEveryShape_notJustSelection', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3), rectShape('b', 10, 0, 2, 2)]);
    const { getAllByTestId } = render(
      <ExportStage
        document={document}
        gridSize={20}
        cropRect={{ x: 0, y: 0, width: 400, height: 200 }}
        includeGrid={false}
        includeDimensions={true}
      />,
    );
    const dimensionLabels = getAllByTestId('konva-text').filter((el) =>
      el.getAttribute('data-name')?.startsWith('dimension-label-'),
    );
    expect(dimensionLabels).toHaveLength(2);
  });

  it('test_ExportStage_toDataUrl_passesMimeTypeQualityAndPixelRatio', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3)]);
    const ref = createRef<ExportStageHandle>();
    render(
      <ExportStage
        ref={ref}
        document={document}
        gridSize={20}
        cropRect={cropRect}
        includeGrid={false}
        includeDimensions={false}
      />,
    );
    const dataUrl = ref.current?.toDataUrl({ mimeType: 'image/jpeg', quality: 0.8, pixelRatio: 2 });
    expect(dataUrl).toContain('w=200');
    expect(dataUrl).toContain('h=120');
    expect(dataUrl).toContain('"mimeType":"image/jpeg"');
    expect(dataUrl).toContain('"quality":0.8');
    expect(dataUrl).toContain('"pixelRatio":2');
  });

  it('test_ExportStage_toDataUrl_beforeMount_returnsNull', () => {
    const ref = createRef<ExportStageHandle>();
    expect(ref.current).toBeNull();
  });

  it('test_ExportStage_doesNotRenderSelectionOrHandleLayers', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3)]);
    const { container } = render(
      <ExportStage
        document={document}
        gridSize={20}
        cropRect={cropRect}
        includeGrid={true}
        includeDimensions={true}
      />,
    );
    // Nothing named after selection frames / resize handles ever appears —
    // this Stage only ever mounts GridBackground / ShapesLayer / DimensionLayer.
    expect(container.querySelector('[data-name^="selection-frame-"]')).toBeNull();
    expect(container.querySelector('[data-name^="resize-handle-"]')).toBeNull();
  });
});
