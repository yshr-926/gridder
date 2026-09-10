import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import { DimensionLayer } from './DimensionLayer';

vi.mock('react-konva', () => ({
  Text: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-text"
      data-name={String(props.name ?? '')}
      data-x={String(props.x ?? '')}
      data-y={String(props.y ?? '')}
      data-text={String(props.text ?? '')}
      data-font-size={String(props.fontSize ?? '')}
      data-wrap={String(props.wrap ?? '')}
    />
  ),
}));

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
});

const documentOf = (
  shapes: readonly EditorShape[],
  physicalScale?: EditorDocument['physicalScale']
): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
  ...(physicalScale !== undefined ? { physicalScale } : {}),
});

describe('DimensionLayer', () => {
  it('test_DimensionLayer_noSelection_rendersNothing', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3)]);
    const { queryByTestId } = render(
      <DimensionLayer document={document} selectedIds={[]} gridSize={10} scale={1} />
    );
    expect(queryByTestId('konva-text')).toBeNull();
  });

  it('test_DimensionLayer_selectedShape_noScale_showsCellCounts', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3)]);
    const { getByTestId } = render(
      <DimensionLayer document={document} selectedIds={['a']} gridSize={10} scale={1} />
    );
    expect(getByTestId('konva-text').getAttribute('data-text')).toBe('4 セル × 3 セル');
  });

  it('test_DimensionLayer_selectedShape_withScale_showsUnitSuffixedLength', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3)], { valuePerCell: 10, unit: 'cm' });
    const { getByTestId } = render(
      <DimensionLayer document={document} selectedIds={['a']} gridSize={10} scale={1} />
    );
    expect(getByTestId('konva-text').getAttribute('data-text')).toBe('40 cm × 30 cm');
  });

  it('test_DimensionLayer_label_neverWraps_evenWhenWiderThanEstimate_issue67', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3)]);
    const { getByTestId } = render(
      <DimensionLayer document={document} selectedIds={['a']} gridSize={10} scale={1} />
    );
    expect(getByTestId('konva-text').getAttribute('data-wrap')).toBe('none');
  });

  it('test_DimensionLayer_multipleSelectedShapes_drawsOneLabelPerShape', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3), rectShape('b', 10, 0, 2, 2)]);
    const { getAllByTestId } = render(
      <DimensionLayer document={document} selectedIds={['a', 'b']} gridSize={10} scale={1} />
    );
    const labels = getAllByTestId('konva-text');
    expect(labels).toHaveLength(2);
    expect(labels.map((el) => el.getAttribute('data-name'))).toEqual([
      'dimension-label-a',
      'dimension-label-b',
    ]);
  });

  it('test_DimensionLayer_skipsSelectedIdWithNoMatchingShape', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3)]);
    const { getAllByTestId } = render(
      <DimensionLayer document={document} selectedIds={['a', 'ghost']} gridSize={10} scale={1} />
    );
    expect(getAllByTestId('konva-text')).toHaveLength(1);
  });

  it('test_DimensionLayer_fontSize_followsDocumentAnnotationFontSize_atElevenTwelfths_issue66', () => {
    const base = documentOf([rectShape('a', 0, 0, 4, 3)]);

    const atDefault = render(
      <DimensionLayer document={base} selectedIds={['a']} gridSize={10} scale={1} />
    );
    expect(Number(atDefault.getByTestId('konva-text').getAttribute('data-font-size'))).toBeCloseTo(
      11
    );
    atDefault.unmount();

    const enlarged = render(
      <DimensionLayer
        document={{ ...base, annotationFontSize: 24 }}
        selectedIds={['a']}
        gridSize={10}
        scale={1}
      />
    );
    expect(Number(enlarged.getByTestId('konva-text').getAttribute('data-font-size'))).toBeCloseTo(
      22
    );
    enlarged.unmount();
  });

  it('test_DimensionLayer_fontSize_isZoomInvariant', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 3)]);

    const zoomedIn = render(
      <DimensionLayer document={document} selectedIds={['a']} gridSize={10} scale={4} />
    );
    const zoomedInFontSize = Number(
      zoomedIn.getByTestId('konva-text').getAttribute('data-font-size')
    );
    zoomedIn.unmount();

    const zoomedOut = render(
      <DimensionLayer document={document} selectedIds={['a']} gridSize={10} scale={1} />
    );
    const zoomedOutFontSize = Number(
      zoomedOut.getByTestId('konva-text').getAttribute('data-font-size')
    );
    zoomedOut.unmount();

    // World-space font size shrinks as zoom grows, so the on-screen size stays constant.
    expect(zoomedInFontSize).toBeLessThan(zoomedOutFontSize);
  });
});
