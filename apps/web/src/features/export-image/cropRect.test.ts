import { describe, expect, it } from 'vitest';
import type { ResolvedDrawingBounds } from '@gridder/editor-core';
import { drawingBoundsToCropRect } from './cropRect';

describe('drawingBoundsToCropRect', () => {
  it('test_drawingBoundsToCropRect_originAtZero_scalesByGridSize', () => {
    const bounds: ResolvedDrawingBounds = { min: { x: 0, y: 0 }, max: { x: 10, y: 6 } };
    expect(drawingBoundsToCropRect(bounds, 20)).toEqual({ x: 0, y: 0, width: 200, height: 120 });
  });

  it('test_drawingBoundsToCropRect_negativeOrigin_offsetsCorrectly', () => {
    const bounds: ResolvedDrawingBounds = { min: { x: -3, y: 2 }, max: { x: 5, y: 9 } };
    expect(drawingBoundsToCropRect(bounds, 10)).toEqual({ x: -30, y: 20, width: 80, height: 70 });
  });

  it('test_drawingBoundsToCropRect_differentGridSize_scalesConsistently', () => {
    const bounds: ResolvedDrawingBounds = { min: { x: 0, y: 0 }, max: { x: 4, y: 4 } };
    expect(drawingBoundsToCropRect(bounds, 32)).toEqual({ x: 0, y: 0, width: 128, height: 128 });
  });
});

describe('drawingBoundsToCropRect with margin (issue #67)', () => {
  it('test_drawingBoundsToCropRect_marginCells_growsEverySideByWholeCells', () => {
    const bounds: ResolvedDrawingBounds = { min: { x: 2, y: 3 }, max: { x: 6, y: 5 } };
    expect(drawingBoundsToCropRect(bounds, 20, 2)).toEqual({
      x: 0,
      y: 20,
      width: 160,
      height: 120,
    });
  });

  it('test_drawingBoundsToCropRect_zeroMargin_matchesDefault', () => {
    const bounds: ResolvedDrawingBounds = { min: { x: 2, y: 3 }, max: { x: 6, y: 5 } };
    expect(drawingBoundsToCropRect(bounds, 20, 0)).toEqual(drawingBoundsToCropRect(bounds, 20));
  });
});
