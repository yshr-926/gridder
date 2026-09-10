import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  SHAPE_FILL_PALETTE,
  type EditorDocument,
  type EditorShape,
  type GridPoint,
  type GridRing,
  type ShapeStyle,
} from '@gridder/editor-core';
import { createDeterministicRandom, type DeterministicRandom } from './deterministicRandom';

/**
 * Benchmark fixture generation for issue #57 (spec §14: "基準データは最大約
 * 500 図形、50,000 セル相当とする").
 *
 * The generator is a pure function of its `seed` and `shapeCount` — no
 * `Math.random`, no wall-clock, no browser API — so the exact same document
 * comes back on every call, which is what makes frame-time measurements
 * comparable across runs and machines. Shapes are laid out on a simple grid
 * of cells with a deterministic per-shape jitter so the fixture isn't a
 * perfectly uniform tiling (closer to a real sketch, and it exercises the
 * renderer's bounding-box / hit-test paths at varied sizes); spec §5 allows
 * shape overlap, so no collision avoidance is needed.
 */

const SHAPE_KINDS = ['rect', 'lShape', 'holedRect'] as const;
type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Target average cell count per shape so `shapeCount` shapes reach `targetCellCount`. */
const AVERAGE_CELL_SIZE_JITTER = 0.4; // +/-40% around the average, deterministic per shape.

const rectRing = (x: number, y: number, width: number, height: number): GridRing => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height },
];

/**
 * An axis-aligned L-shape: a `width` x `height` rectangle with a
 * `notchWidth` x `notchHeight` corner removed, chosen so it stays concave and
 * simply connected (spec §5 "凹形状" — a shape with a concave corner, as
 * opposed to `holedRect`'s enclosed hole). The notch is cut from whichever
 * corner keeps both remaining arms at least one cell wide.
 */
const lShapeRing = (
  x: number,
  y: number,
  width: number,
  height: number,
  notchWidth: number,
  notchHeight: number
): GridRing => {
  const nw = Math.min(notchWidth, width - 1);
  const nh = Math.min(notchHeight, height - 1);
  // Notch out of the top-right corner.
  return [
    { x, y },
    { x: x + width - nw, y },
    { x: x + width - nw, y: y + nh },
    { x: x + width, y: y + nh },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
};

const cellCountOfRect = (width: number, height: number): number => width * height;

const cellCountOfLShape = (
  width: number,
  height: number,
  notchWidth: number,
  notchHeight: number
): number => width * height - Math.min(notchWidth, width - 1) * Math.min(notchHeight, height - 1);

const cellCountOfHoledRect = (
  width: number,
  height: number,
  holeWidth: number,
  holeHeight: number
): number => width * height - holeWidth * holeHeight;

const styleForShape = (random: DeterministicRandom, opacity: number): ShapeStyle => ({
  fill: SHAPE_FILL_PALETTE[random.nextInt(0, SHAPE_FILL_PALETTE.length - 1)],
  opacity,
  isBorderVisible: true,
});

interface GeneratedShape {
  readonly shape: EditorShape;
  readonly cellCount: number;
}

/**
 * Builds one shape whose footprint is roughly `targetCells` cells (subject to
 * the jitter above), anchored with its bounding-box top-left at `origin`.
 * `kind` cycles deterministically across the fixture so all three shape
 * families (rectangle, concave L-shape, rectangle with a hole — spec §5) are
 * represented, not just axis-aligned rectangles.
 */
const buildShape = (
  id: string,
  kind: ShapeKind,
  origin: GridPoint,
  targetCells: number,
  random: DeterministicRandom,
  index: number
): GeneratedShape => {
  const jitter = 1 + (random.nextFloat() * 2 - 1) * AVERAGE_CELL_SIZE_JITTER;
  // `lShape` and `holedRect` remove part of their bounding box (a notch, or a
  // hole), so the box itself must be inflated by roughly the fraction that
  // will be cut away — otherwise the fixture's total cell count drifts well
  // under spec §14's ~50,000-cell target once every third shape loses ~1/9
  // (L-shape notch) or up to half (large hole) of its footprint.
  const boundingBoxInflation = kind === 'rect' ? 1 : kind === 'lShape' ? 1 / (1 - 1 / 9) : 1.6;
  const area = Math.max(4, Math.round(targetCells * jitter * boundingBoxInflation));
  // Keep shapes roughly square-ish rather than 1-cell-tall slivers.
  const width = Math.max(2, Math.round(Math.sqrt(area)));
  const height = Math.max(2, Math.round(area / width));
  const opacity = 0.6 + random.nextFloat() * 0.35;
  const style = styleForShape(random, Number(opacity.toFixed(2)));

  if (kind === 'rect') {
    return {
      shape: {
        id,
        polygon: { outerRing: rectRing(origin.x, origin.y, width, height), innerRings: [] },
        style,
        name: `Rect ${index}`,
      },
      cellCount: cellCountOfRect(width, height),
    };
  }

  if (kind === 'lShape') {
    const notchWidth = Math.max(1, Math.round(width / 3));
    const notchHeight = Math.max(1, Math.round(height / 3));
    return {
      shape: {
        id,
        polygon: {
          outerRing: lShapeRing(origin.x, origin.y, width, height, notchWidth, notchHeight),
          innerRings: [],
        },
        style,
        name: `L-shape ${index}`,
      },
      cellCount: cellCountOfLShape(width, height, notchWidth, notchHeight),
    };
  }

  // holedRect: hole is centred and at least one cell of margin remains on
  // every side, so the outer and inner rings never touch (a valid polygon
  // per editor-core's validation — touching rings would merge the hole into
  // the outer boundary).
  const holeWidth = Math.max(1, width - 4);
  const holeHeight = Math.max(1, height - 4);
  const holeX = origin.x + Math.floor((width - holeWidth) / 2);
  const holeY = origin.y + Math.floor((height - holeHeight) / 2);
  return {
    shape: {
      id,
      polygon: {
        outerRing: rectRing(origin.x, origin.y, width, height),
        innerRings: [rectRing(holeX, holeY, holeWidth, holeHeight)],
      },
      style,
      name: `Holed rect ${index}`,
    },
    cellCount: cellCountOfHoledRect(width, height, holeWidth, holeHeight),
  };
};

export interface BenchmarkDocumentOptions {
  /** Deterministic seed; the same seed always produces the same document. */
  readonly seed?: number;
  /** Number of shapes to generate (spec §14: "最大約500図形"). */
  readonly shapeCount?: number;
  /** Approximate total cell count across every shape (spec §14: "50,000セル相当"). */
  readonly targetCellCount?: number;
}

export interface BenchmarkDocumentResult {
  readonly document: EditorDocument;
  /** Sum of each generated shape's approximate cell footprint. */
  readonly totalCellCount: number;
}

const DEFAULT_SEED = 57_005_700; // arbitrary, fixed: readable as "57 0057 00" (issue #57).
const DEFAULT_SHAPE_COUNT = 500;
const DEFAULT_TARGET_CELL_COUNT = 50_000;

/** Cells of horizontal/vertical gap kept between a shape's bounding box and the next grid cursor. */
const LAYOUT_GAP = 2;

/**
 * Generates a deterministic {@link EditorDocument} approximating spec §14's
 * performance benchmark fixture: ~500 shapes totalling ~50,000 cells, mixing
 * plain rectangles with concave L-shapes and shapes with a hole (spec §5).
 * Pure and side-effect free — safe to call from a Vitest test, from dev-only
 * bootstrap code, or from a Playwright fixture.
 */
export const generateBenchmarkDocument = (
  options: BenchmarkDocumentOptions = {}
): BenchmarkDocumentResult => {
  const seed = options.seed ?? DEFAULT_SEED;
  const shapeCount = options.shapeCount ?? DEFAULT_SHAPE_COUNT;
  const targetCellCount = options.targetCellCount ?? DEFAULT_TARGET_CELL_COUNT;
  const random = createDeterministicRandom(seed);

  const averageCellsPerShape = targetCellCount / shapeCount;
  // A roughly square layout grid so shapes are laid out row by row instead
  // of one long strip; spec §5 allows overlap but a fixture that isn't a
  // single opaque stack is far more useful for scrolling / hit-testing
  // during measurement.
  const columns = Math.ceil(Math.sqrt(shapeCount));

  const shapes: EditorShape[] = [];
  const zOrder: string[] = [];
  let totalCellCount = 0;
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (let index = 0; index < shapeCount; index += 1) {
    const kind = SHAPE_KINDS[index % SHAPE_KINDS.length];
    const id = `bench-${index}`;
    const generated = buildShape(
      id,
      kind,
      { x: cursorX, y: cursorY },
      averageCellsPerShape,
      random,
      index
    );

    shapes.push(generated.shape);
    zOrder.push(id);
    totalCellCount += generated.cellCount;

    const bounds = generated.shape.polygon.outerRing.reduce(
      (acc, point) => ({
        width: Math.max(acc.width, point.x - cursorX),
        height: Math.max(acc.height, point.y - cursorY),
      }),
      { width: 0, height: 0 }
    );
    rowHeight = Math.max(rowHeight, bounds.height);
    cursorX += bounds.width + LAYOUT_GAP;

    if ((index + 1) % columns === 0) {
      cursorX = 0;
      cursorY += rowHeight + LAYOUT_GAP;
      rowHeight = 0;
    }
  }

  const maxX = Math.max(
    1,
    ...shapes.map((shape) => Math.max(...shape.polygon.outerRing.map((p) => p.x)))
  );
  const maxY = Math.max(
    1,
    ...shapes.map((shape) => Math.max(...shape.polygon.outerRing.map((p) => p.y)))
  );

  const document: EditorDocument = {
    formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
    annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
    shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
    zOrder,
    groups: {},
    drawingBounds: {
      mode: 'auto',
      min: { x: 0, y: 0 },
      max: { x: maxX, y: maxY },
    },
  };

  return { document, totalCellCount };
};

export { DEFAULT_SEED, DEFAULT_SHAPE_COUNT, DEFAULT_TARGET_CELL_COUNT };
