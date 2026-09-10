import { describe, expect, it } from 'vitest';
import type { GridPolygon } from '../model.js';
import { createPolygonClippingEngine } from './polygon-clipping-engine.js';
import {
  assertNormalized,
  coveredCells,
  coveredDoubleArea,
  createRandom,
  resultKey,
  square,
} from './test-helpers.js';

/**
 * Property tests over randomly generated cell sets. The generator and PRNG are
 * self-contained (mulberry32) so every run is reproducible from its seed.
 */

const engine = createPolygonClippingEngine();

const GRID_SIZE = 6;
const SEEDS = [1, 2, 3, 7, 11, 42, 99, 256, 1024, 65535];

/** A set of `"x,y"` cell keys chosen from a `GRID_SIZE x GRID_SIZE` grid. */
const randomCellSet = (random: () => number, count: number): Set<string> => {
  const cells = new Set<string>();
  let guard = 0;
  while (cells.size < count && guard < count * 20) {
    guard += 1;
    const x = Math.floor(random() * GRID_SIZE);
    const y = Math.floor(random() * GRID_SIZE);
    cells.add(`${x},${y}`);
  }
  return cells;
};

const cellKeyToSquare = (key: string): GridPolygon => {
  const [x, y] = key.split(',').map((value) => Number.parseInt(value, 10));
  return square(x as number, y as number);
};

/** Union of every cell in the set, as a normalized result. */
const unionOfCells = (cells: Iterable<string>): readonly GridPolygon[] => {
  const operands = [...cells].map(cellKeyToSquare);
  return operands.length === 0 ? [] : engine.union(operands);
};

const RASTER_BOUNDS = {
  minX: -1,
  minY: -1,
  maxX: GRID_SIZE + 1,
  maxY: GRID_SIZE + 1,
};

describe('property: union of cells always yields a normalized result', () => {
  it.each(SEEDS)('seed %i', (seed) => {
    const random = createRandom(seed);
    for (let trial = 0; trial < 12; trial += 1) {
      const cells = randomCellSet(random, 1 + Math.floor(random() * 12));
      const result = unionOfCells(cells);

      assertNormalized(result);
      // Covered area equals the number of distinct cells (doubled).
      expect(coveredDoubleArea(result)).toBe(cells.size * 2);
      // Rasterized coverage is exactly the chosen cells.
      const covered = coveredCells(result, RASTER_BOUNDS);
      expect([...covered].sort()).toEqual([...cells].sort());
    }
  });
});

describe('property: adding a cell already covered is a no-op', () => {
  it.each(SEEDS)('seed %i', (seed) => {
    const random = createRandom(seed);
    for (let trial = 0; trial < 12; trial += 1) {
      const cells = randomCellSet(random, 2 + Math.floor(random() * 10));
      const cellList = [...cells];
      const base = unionOfCells(cells);
      const duplicated = cellList[Math.floor(random() * cellList.length)];

      const again = engine.union([...base, cellKeyToSquare(duplicated as string)]);

      expect(resultKey(again)).toBe(resultKey(base));
    }
  });
});

describe('property: repeating the same union is byte-identical (stability)', () => {
  it.each(SEEDS)('seed %i', (seed) => {
    const random = createRandom(seed);
    for (let trial = 0; trial < 10; trial += 1) {
      const cells = randomCellSet(random, 3 + Math.floor(random() * 10));
      const first = unionOfCells(cells);

      let previous = first;
      for (let iteration = 0; iteration < 4; iteration += 1) {
        const next = unionOfCells(cells);
        expect(JSON.stringify(next)).toBe(JSON.stringify(previous));
        previous = next;
      }
    }
  });
});

describe('property: add then remove the same cell returns to the original', () => {
  it.each(SEEDS)('seed %i', (seed) => {
    const random = createRandom(seed);
    for (let trial = 0; trial < 12; trial += 1) {
      const cells = randomCellSet(random, 3 + Math.floor(random() * 9));
      const base = unionOfCells(cells);
      if (base.length !== 1) {
        // Only exercise the single-component case; multi-component subjects
        // need per-component routing that lives above the Adapter.
        continue;
      }

      let freeCell = '';
      for (let x = 0; x < GRID_SIZE && freeCell === ''; x += 1) {
        for (let y = 0; y < GRID_SIZE && freeCell === ''; y += 1) {
          if (!cells.has(`${x},${y}`)) {
            freeCell = `${x},${y}`;
          }
        }
      }
      if (freeCell === '') {
        continue;
      }

      const grown = engine.union([base[0] as GridPolygon, cellKeyToSquare(freeCell)]);
      const shrunk = engine.difference(grown[0] as GridPolygon, [cellKeyToSquare(freeCell)]);

      assertNormalized(shrunk);
      expect(resultKey(shrunk)).toBe(resultKey(base));
    }
  });
});

describe('property: difference never increases covered area', () => {
  it.each(SEEDS)('seed %i', (seed) => {
    const random = createRandom(seed);
    for (let trial = 0; trial < 12; trial += 1) {
      const cells = randomCellSet(random, 4 + Math.floor(random() * 10));
      const base = unionOfCells(cells);
      if (base.length !== 1) {
        continue;
      }
      const clipCells = randomCellSet(random, 1 + Math.floor(random() * 4));
      const clips = [...clipCells].map(cellKeyToSquare);

      const result = engine.difference(base[0] as GridPolygon, clips);

      assertNormalized(result);
      expect(coveredDoubleArea(result)).toBeLessThanOrEqual(coveredDoubleArea(base));

      const remaining = coveredCells(result, RASTER_BOUNDS);
      for (const clip of clipCells) {
        expect(remaining.has(clip)).toBe(false);
      }
    }
  });
});
