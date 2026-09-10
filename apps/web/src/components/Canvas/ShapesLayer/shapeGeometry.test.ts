import { describe, it, expect } from 'vitest';
import type { GridPolygon } from '@gridder/editor-core';
import {
  ringToPixelPath,
  polygonToPixelPaths,
  polygonBoundingBox,
  polygonCenterPixel,
} from './shapeGeometry';

describe('ringToPixelPath', () => {
  it('test_ringToPixelPath_rectangle_returnsFlatScaledCoords', () => {
    const ring = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      { x: 0, y: 3 },
    ];

    const path = ringToPixelPath(ring, 10);

    expect(path).toEqual([0, 0, 20, 0, 20, 30, 0, 30]);
  });

  it('test_ringToPixelPath_doesNotRepeatFirstVertex', () => {
    const ring = [
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
    ];

    const path = ringToPixelPath(ring, 1);

    // 3 vertices -> 6 numbers, closure stays implicit.
    expect(path).toHaveLength(6);
    expect(path).toEqual([1, 1, 4, 1, 4, 4]);
  });
});

describe('polygonToPixelPaths', () => {
  it('test_polygonToPixelPaths_outerFirstThenHoles', () => {
    const polygon: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      innerRings: [
        [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 2, y: 2 },
          { x: 1, y: 2 },
        ],
      ],
    };

    const paths = polygonToPixelPaths(polygon, 10);

    expect(paths).toHaveLength(2);
    expect(paths[0]).toEqual([0, 0, 40, 0, 40, 40, 0, 40]);
    expect(paths[1]).toEqual([10, 10, 20, 10, 20, 20, 10, 20]);
  });
});

describe('polygonBoundingBox', () => {
  it('test_polygonBoundingBox_concaveOuterRing_usesExtremes', () => {
    const polygon: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 3 },
        { x: 2, y: 3 },
        { x: 2, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [],
    };

    expect(polygonBoundingBox(polygon)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 6,
      maxY: 6,
      width: 6,
      height: 6,
    });
  });

  it('test_polygonBoundingBox_emptyOuterRing_returnsZeroBox', () => {
    const polygon: GridPolygon = { outerRing: [], innerRings: [] };

    expect(polygonBoundingBox(polygon)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    });
  });
});

describe('polygonCenterPixel', () => {
  it('test_polygonCenterPixel_returnsScaledBoundingBoxCenter', () => {
    const polygon: GridPolygon = {
      outerRing: [
        { x: 2, y: 4 },
        { x: 6, y: 4 },
        { x: 6, y: 8 },
        { x: 2, y: 8 },
      ],
      innerRings: [],
    };

    expect(polygonCenterPixel(polygon, 10)).toEqual({ x: 40, y: 60 });
  });
});
