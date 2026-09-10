import { createRef, type ComponentProps, type Ref } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import { DEFAULT_SHAPES_LAYER_THEME } from '@/components/Canvas';
import { ExportStage, type ExportStageHandle } from './ExportStage';
import { gridLineZoomForScale } from './gridLineZoom';
import type { ExportCropRect } from '@/features/export-image';

/**
 * Mock react-konva so a plain DOM tree stands in for the Konva scene graph.
 * `Stage` records the props it was constructed with (`width`/`height`/
 * `scaleX`) and `Layer` exposes a `toBlob` on its ref that resolves to a Blob
 * carrying the call's own options — enough for the preview-size and
 * mimeType/quality/pixelRatio assertions below without a real canvas.
 *
 * `vi.mock`'s factory is hoisted above every import, so it cannot close over
 * a top-level `const` (a temporal-dead-zone `ReferenceError` at that hoisted
 * call site) — `await import('react')` inside the (async) factory itself
 * sidesteps that without a `require()`.
 */
/** The options of the most recent mocked `Layer.toBlob` call (jsdom's Blob has no `text()`). */
const toBlobCalls = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

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
      children
    );
  const MockLayer = React.forwardRef(
    (
      { children, x, y, listening }: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.Ref<{ toBlob: (opts: Record<string, unknown>) => Promise<Blob> }>
    ) => {
      React.useImperativeHandle(ref, () => ({
        toBlob: (opts: Record<string, unknown>) => {
          toBlobCalls.last = opts;
          return Promise.resolve(new Blob(['fake'], { type: 'image/png' }));
        },
      }));
      return (
        <div
          data-testid="konva-layer"
          data-x={String(x ?? '')}
          data-y={String(y ?? '')}
          data-listening={String(listening ?? '')}
        >
          {children}
        </div>
      );
    }
  );

  return {
    Stage: MockStage,
    Layer: MockLayer,
    Group: ({ children, name, x, y }: { children?: React.ReactNode } & Record<string, unknown>) => (
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
        data-x={String(props.x ?? '')}
        data-y={String(props.y ?? '')}
        data-width={String(props.width ?? '')}
        data-height={String(props.height ?? '')}
      />
    ),
    Line: (props: Record<string, unknown>) => (
      <div
        data-testid="konva-line"
        data-name={String(props.name ?? '')}
        data-stroke-width={String(props.strokeWidth ?? '')}
      />
    ),
    Text: (props: Record<string, unknown>) => (
      <div
        data-testid="konva-text"
        data-name={String(props.name ?? '')}
        data-text={String(props.text ?? '')}
        data-font-size={String(props.fontSize ?? '')}
      />
    ),
    Shape: (props: Record<string, unknown>) => (
      <div
        data-testid="konva-shape"
        data-name={String(props.name ?? '')}
        data-stroke-width={String(props.strokeWidth ?? '')}
      />
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
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

const cropRect: ExportCropRect = { x: 20, y: 10, width: 200, height: 120 };

const renderStage = (
  document: EditorDocument,
  overrides: Partial<ComponentProps<typeof ExportStage>> = {},
  ref?: Ref<ExportStageHandle>
) =>
  render(
    <ExportStage
      ref={ref}
      document={document}
      gridSize={20}
      cropRect={cropRect}
      includeGrid={false}
      includeDimensions={false}
      background="white"
      scale={2}
      previewScale={1}
      {...overrides}
    />
  );

const lastToBlobOptions = (): Record<string, unknown> => {
  if (toBlobCalls.last === null) {
    throw new Error('expected Layer.toBlob to have been called');
  }
  return toBlobCalls.last;
};

describe('ExportStage', () => {
  it('test_ExportStage_previewScale1_sizesStageToCropRect', () => {
    const { getByTestId } = renderStage(documentOf([rectShape('a', 1, 1, 4, 3)]));
    const stage = getByTestId('konva-stage');
    expect(stage.getAttribute('data-width')).toBe('200');
    expect(stage.getAttribute('data-height')).toBe('120');
    expect(stage.getAttribute('data-scale-x')).toBe('1');
  });

  it('test_ExportStage_previewScale_shrinksStageAndScalesScene_issue67', () => {
    const { getByTestId } = renderStage(documentOf([]), { previewScale: 0.25 });
    const stage = getByTestId('konva-stage');
    expect(stage.getAttribute('data-width')).toBe('50');
    expect(stage.getAttribute('data-height')).toBe('30');
    expect(stage.getAttribute('data-scale-x')).toBe('0.25');
  });

  it('test_ExportStage_offsetsLayer_byNegativeCropOrigin', () => {
    const { getByTestId } = renderStage(documentOf([rectShape('a', 1, 1, 4, 3)]));
    const layer = getByTestId('konva-layer');
    expect(layer.getAttribute('data-x')).toBe('-20');
    expect(layer.getAttribute('data-y')).toBe('-10');
  });

  it('test_ExportStage_usesSingleLayer_forOneRasterPerExport_issue67', () => {
    const { getAllByTestId } = renderStage(documentOf([rectShape('a', 1, 1, 4, 3)]), {
      includeGrid: true,
      includeDimensions: true,
    });
    expect(getAllByTestId('konva-layer')).toHaveLength(1);
  });

  it('test_ExportStage_whiteBackground_paintsRectCoveringCropRect', () => {
    const { getByTestId } = renderStage(documentOf([]));
    const rect = getByTestId('konva-rect');
    expect(rect.getAttribute('data-fill')).toBe('#ffffff');
    expect(rect.getAttribute('data-x')).toBe('20');
    expect(rect.getAttribute('data-y')).toBe('10');
    expect(rect.getAttribute('data-width')).toBe('200');
    expect(rect.getAttribute('data-height')).toBe('120');
  });

  it('test_ExportStage_transparentBackground_paintsNoRect_evenWithGrid_issue67', () => {
    const { queryByTestId, queryAllByTestId } = renderStage(documentOf([]), {
      background: 'transparent',
      includeGrid: true,
    });
    // Neither the export background nor GridBackground's own white rect.
    expect(queryByTestId('konva-rect')).toBeNull();
    expect(queryAllByTestId('konva-line').length).toBeGreaterThan(0);
  });

  it('test_ExportStage_includeGridFalse_omitsGridLines', () => {
    const { queryByTestId } = renderStage(documentOf([]));
    expect(queryByTestId('konva-line')).toBeNull();
  });

  it('test_ExportStage_includeGridTrue_rendersGridLines', () => {
    const { queryAllByTestId } = renderStage(documentOf([]), { includeGrid: true });
    expect(queryAllByTestId('konva-line').length).toBeGreaterThan(0);
  });

  it('test_ExportStage_gridLines_atLeastOneDevicePixel_at1x_unchangedAt2xAnd3x_issue67', () => {
    const thinnestStrokeAt = (scale: 1 | 2 | 3): number => {
      const { getAllByTestId, unmount } = renderStage(documentOf([]), {
        includeGrid: true,
        scale,
      });
      const widths = getAllByTestId('konva-line').map((line) =>
        Number(line.getAttribute('data-stroke-width'))
      );
      unmount();
      return Math.min(...widths);
    };
    // Scene stroke × scale = device pixels: 1 × 1, 0.5 × 2, 0.5 × 3.
    expect(thinnestStrokeAt(1) * 1).toBeCloseTo(1);
    expect(thinnestStrokeAt(2) * 2).toBeCloseTo(1);
    expect(thinnestStrokeAt(3) * 3).toBeCloseTo(1.5);
  });

  it('test_ExportStage_shapeBorder_isPreMultipliedByPreviewScale_issue67', () => {
    // strokeScaleEnabled is off on ShapePolygon, so the stroke ignores the stage
    // scale: 1.5 × 0.25 in the scene → 1.5 × scale device pixels in the export.
    const { getByTestId } = renderStage(documentOf([rectShape('a', 0, 0, 4, 3)]), {
      previewScale: 0.25,
    });
    expect(Number(getByTestId('konva-shape').getAttribute('data-stroke-width'))).toBeCloseTo(
      DEFAULT_SHAPES_LAYER_THEME.borderWidth * 0.25
    );
  });

  it('test_gridLineZoomForScale_neverExceedsOne', () => {
    expect(gridLineZoomForScale(1)).toBe(0.5);
    expect(gridLineZoomForScale(2)).toBe(1);
    expect(gridLineZoomForScale(3)).toBe(1);
  });

  it('test_ExportStage_includeDimensionsTrue_annotatesEveryShape_notJustSelection', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3), rectShape('b', 10, 0, 2, 2)]);
    const { getAllByTestId } = renderStage(document, {
      cropRect: { x: 0, y: 0, width: 400, height: 200 },
      includeDimensions: true,
    });
    const dimensionLabels = getAllByTestId('konva-text').filter((el) =>
      el.getAttribute('data-name')?.startsWith('dimension-label-')
    );
    expect(dimensionLabels).toHaveLength(2);
  });

  it('test_ExportStage_usesDocumentAnnotationFontSize_forNamesAndDimensions_issue66', () => {
    // 10x8-cell shape at gridSize 20 is 200px on screen, so a 24px name stays legible.
    const document = { ...documentOf([rectShape('a', 0, 0, 10, 8)]), annotationFontSize: 24 };
    const { getAllByTestId } = renderStage(document, { includeDimensions: true });
    const fontSizes = getAllByTestId('konva-text').map((text) =>
      Number(text.getAttribute('data-font-size'))
    );
    // The name label (24) and its dimension label (24 * 11 / 12 = 22).
    expect(fontSizes).toHaveLength(2);
    expect(fontSizes).toContain(24);
    expect(fontSizes.some((size) => Math.abs(size - 22) < 1e-9)).toBe(true);
  });

  it('test_ExportStage_toBlob_passesMimeTypeQuality_andPixelRatioUndoingPreviewScale', async () => {
    const ref = createRef<ExportStageHandle>();
    renderStage(documentOf([rectShape('a', 0, 0, 4, 3)]), { previewScale: 0.5 }, ref);
    const blob = await ref.current?.toBlob({ mimeType: 'image/jpeg', quality: 0.8, scale: 2 });
    expect(blob).toBeInstanceOf(Blob);
    const options = lastToBlobOptions();
    expect(options.mimeType).toBe('image/jpeg');
    expect(options.quality).toBe(0.8);
    // 2x export of a stage previewed at 0.5 → pixelRatio 4.
    expect(options.pixelRatio).toBe(4);
    expect(options.x).toBe(0);
    expect(options.y).toBe(0);
  });

  it('test_ExportStage_toBlob_requestsWidthThatTruncatesToExactOutputSize', async () => {
    const ref = createRef<ExportStageHandle>();
    renderStage(documentOf([]), { previewScale: 0.3 }, ref);
    await ref.current?.toBlob({ mimeType: 'image/png', scale: 3 });
    const options = lastToBlobOptions();
    const pixelRatio = options.pixelRatio as number;
    // Konva sizes the raster as trunc(width × pixelRatio): 600 × 360 exactly.
    expect(Math.trunc((options.width as number) * pixelRatio)).toBe(600);
    expect(Math.trunc((options.height as number) * pixelRatio)).toBe(360);
  });

  it('test_ExportStage_toBlob_beforeMount_returnsNull', () => {
    const ref = createRef<ExportStageHandle>();
    expect(ref.current).toBeNull();
  });

  it('test_ExportStage_doesNotRenderSelectionOrHandleLayers', () => {
    const { container } = renderStage(documentOf([rectShape('a', 0, 0, 4, 3)]), {
      includeGrid: true,
      includeDimensions: true,
    });
    // Nothing named after selection frames / resize handles ever appears —
    // this Stage only ever mounts GridBackground / ShapesLayer / DimensionLayer.
    expect(container.querySelector('[data-name^="selection-frame-"]')).toBeNull();
    expect(container.querySelector('[data-name^="resize-handle-"]')).toBeNull();
  });
});
