import { describe, expect, it } from 'vitest';
import { validateDocument } from '@gridder/editor-core';
import {
  DEFAULT_SEED,
  DEFAULT_SHAPE_COUNT,
  DEFAULT_TARGET_CELL_COUNT,
  generateBenchmarkDocument,
} from './generateBenchmarkDocument';

describe('generateBenchmarkDocument', () => {
  it('test_generateBenchmarkDocument_sameSeed_producesIdenticalDocuments', () => {
    const first = generateBenchmarkDocument({ seed: 1 });
    const second = generateBenchmarkDocument({ seed: 1 });

    expect(first).toEqual(second);
  });

  it('test_generateBenchmarkDocument_differentSeeds_produceDifferentDocuments', () => {
    const first = generateBenchmarkDocument({ seed: 1 });
    const second = generateBenchmarkDocument({ seed: 2 });

    expect(first.document).not.toEqual(second.document);
  });

  it('test_generateBenchmarkDocument_defaults_matchSpecTargets', () => {
    const { document, totalCellCount } = generateBenchmarkDocument();

    expect(document.zOrder).toHaveLength(DEFAULT_SHAPE_COUNT);
    expect(Object.keys(document.shapes)).toHaveLength(DEFAULT_SHAPE_COUNT);
    // The jittered per-shape footprint means the total only approximates the
    // target (spec §14 "50,000セル相当"); require it within +/-15%.
    expect(totalCellCount).toBeGreaterThan(DEFAULT_TARGET_CELL_COUNT * 0.85);
    expect(totalCellCount).toBeLessThan(DEFAULT_TARGET_CELL_COUNT * 1.15);
  });

  it('test_generateBenchmarkDocument_defaultSeed_isStableAcrossCalls', () => {
    const { document: first } = generateBenchmarkDocument({ seed: DEFAULT_SEED });
    const { document: second } = generateBenchmarkDocument();

    expect(first).toEqual(second);
  });

  it('test_generateBenchmarkDocument_producesAllThreeShapeFamilies', () => {
    const { document } = generateBenchmarkDocument({ shapeCount: 30, targetCellCount: 3000 });

    const shapes = Object.values(document.shapes);
    const hasHole = shapes.some((shape) => shape.polygon.innerRings.length > 0);
    const hasConcave = shapes.some((shape) => shape.polygon.outerRing.length === 6);
    const hasPlainRect = shapes.some(
      (shape) => shape.polygon.outerRing.length === 4 && shape.polygon.innerRings.length === 0
    );

    expect(hasHole).toBe(true);
    expect(hasConcave).toBe(true);
    expect(hasPlainRect).toBe(true);
  });

  it('test_generateBenchmarkDocument_resultPassesEditorCoreValidation', () => {
    const { document } = generateBenchmarkDocument();
    const issues = validateDocument(document);

    expect(issues).toEqual([]);
  });

  it('test_generateBenchmarkDocument_smallerFixture_alsoPassesValidation', () => {
    const { document } = generateBenchmarkDocument({ shapeCount: 12, targetCellCount: 500, seed: 999 });
    expect(validateDocument(document)).toEqual([]);
  });

  it('test_generateBenchmarkDocument_everyShapeIdMatchesItsZOrderEntry_andRecordKey', () => {
    const { document } = generateBenchmarkDocument({ shapeCount: 20, targetCellCount: 800 });

    document.zOrder.forEach((shapeId) => {
      expect(document.shapes[shapeId]?.id).toBe(shapeId);
    });
  });

  it('test_generateBenchmarkDocument_drawingBoundsEnclosesEveryShape', () => {
    const { document } = generateBenchmarkDocument({ shapeCount: 40, targetCellCount: 2000 });
    const { min, max } = document.drawingBounds;

    Object.values(document.shapes).forEach((shape) => {
      shape.polygon.outerRing.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(min.x);
        expect(point.y).toBeGreaterThanOrEqual(min.y);
        expect(point.x).toBeLessThanOrEqual(max.x);
        expect(point.y).toBeLessThanOrEqual(max.y);
      });
    });
  });

  it('test_generateBenchmarkDocument_zeroShapes_returnsAnEmptyButValidDocument', () => {
    const { document, totalCellCount } = generateBenchmarkDocument({ shapeCount: 0, targetCellCount: 0 });

    expect(document.zOrder).toEqual([]);
    expect(totalCellCount).toBe(0);
    expect(validateDocument(document)).toEqual([]);
  });
});
