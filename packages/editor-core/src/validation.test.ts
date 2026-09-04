import { describe, expect, it } from 'vitest';

import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  isDocumentValid,
  validateDocument,
} from './index.js';

const rectangle: EditorShape = {
  id: 'shape-a',
  polygon: {
    // Rings close implicitly, so this rectangle contains exactly four entries.
    outerRing: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ],
    innerRings: [],
  },
  style: {
    fill: '#3b82f6',
    opacity: 0.8,
    isBorderVisible: true,
  },
  name: 'Desk',
};

const shapeWithHole: EditorShape = {
  id: 'shape-b',
  polygon: {
    outerRing: [
      { x: 6, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 6 },
      { x: 6, y: 6 },
    ],
    innerRings: [
      [
        { x: 8, y: 2 },
        { x: 8, y: 4 },
        { x: 10, y: 4 },
        { x: 10, y: 2 },
      ],
    ],
  },
  style: {
    fill: '#22c55e',
    opacity: 1,
    isBorderVisible: false,
  },
};

const createValidDocument = (): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: {
    'shape-a': rectangle,
    'shape-b': shapeWithHole,
  },
  zOrder: ['shape-a', 'shape-b'],
  groups: {
    'group-a': {
      id: 'group-a',
      shapeIds: ['shape-a', 'shape-b'],
    },
  },
  drawingBounds: {
    mode: 'auto',
    min: { x: 0, y: 0 },
    max: { x: 12, y: 6 },
  },
  physicalScale: {
    valuePerCell: 50,
    unit: 'cm',
  },
});

const issueCodes = (document: EditorDocument): readonly string[] =>
  validateDocument(document).map(({ code }) => code);

describe('validateDocument', () => {
  it('accepts a complete framework-free document model', () => {
    const document = createValidDocument();

    expect(validateDocument(document)).toEqual([]);
    expect(isDocumentValid(document)).toBe(true);
  });

  it('rejects non-integer grid vertices in outer and inner rings', () => {
    const document = createValidDocument();
    const invalidDocument: EditorDocument = {
      ...document,
      shapes: {
        ...document.shapes,
        'shape-b': {
          ...shapeWithHole,
          polygon: {
            outerRing: [{ x: 6.5, y: 0 }, ...shapeWithHole.polygon.outerRing.slice(1)],
            innerRings: [
              [{ x: 8, y: 2.25 }, ...shapeWithHole.polygon.innerRings[0]!.slice(1)],
            ],
          },
        },
      },
    };

    expect(issueCodes(invalidDocument)).toEqual([
      'non-integer-coordinate',
      'non-integer-coordinate',
    ]);
  });

  it('rejects rings with fewer than three distinct vertices', () => {
    const document = createValidDocument();
    const invalidDocument: EditorDocument = {
      ...document,
      shapes: {
        'shape-a': {
          ...rectangle,
          polygon: {
            outerRing: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 0 },
            ],
            innerRings: [],
          },
        },
      },
      zOrder: ['shape-a'],
      groups: {},
    };

    expect(issueCodes(invalidDocument)).toContain('invalid-ring');
  });

  it('rejects adjacent duplicates across the implicit closing edge', () => {
    const document = createValidDocument();
    const invalidDocument: EditorDocument = {
      ...document,
      shapes: {
        'shape-a': {
          ...rectangle,
          polygon: {
            ...rectangle.polygon,
            outerRing: [...rectangle.polygon.outerRing, { x: 0, y: 0 }],
          },
        },
      },
      zOrder: ['shape-a'],
      groups: {},
    };

    expect(issueCodes(invalidDocument)).toContain('consecutive-duplicate-vertex');
  });

  it('requires z-order to contain every shape exactly once', () => {
    const document = createValidDocument();
    const invalidDocument: EditorDocument = {
      ...document,
      zOrder: ['shape-a', 'shape-a', 'missing-shape'],
    };

    expect(issueCodes(invalidDocument)).toEqual([
      'duplicate-z-order-entry',
      'unknown-z-order-shape',
      'missing-z-order-shape',
    ]);
  });

  it('rejects nested groups and membership in multiple groups', () => {
    const document = createValidDocument();
    const invalidDocument: EditorDocument = {
      ...document,
      groups: {
        'group-a': {
          id: 'group-a',
          shapeIds: ['shape-a', 'shape-b'],
        },
        'group-b': {
          id: 'group-b',
          shapeIds: ['shape-a', 'group-a'],
        },
      },
    };

    expect(issueCodes(invalidDocument)).toEqual([
      'shape-in-multiple-groups',
      'nested-group',
    ]);
  });

  it('rejects invalid style, drawing bounds, and physical scale values', () => {
    const document = createValidDocument();
    const invalidDocument: EditorDocument = {
      ...document,
      shapes: {
        ...document.shapes,
        'shape-a': {
          ...rectangle,
          style: {
            ...rectangle.style,
            fill: '#ffffff' as EditorShape['style']['fill'],
            opacity: 1.5,
          },
        },
      },
      drawingBounds: {
        mode: 'manual',
        min: { x: 4, y: 2 },
        max: { x: 4, y: 1 },
      },
      physicalScale: {
        valuePerCell: 0,
        unit: 'm',
      },
    };

    expect(issueCodes(invalidDocument)).toEqual([
      'invalid-fill-color',
      'invalid-opacity',
      'invalid-drawing-bounds',
      'invalid-physical-scale',
    ]);
  });

  it('rejects mismatched record IDs and an unsupported format version', () => {
    const document = createValidDocument();
    const invalidDocument = {
      ...document,
      formatVersion: 2,
      shapes: {
        'shape-key': rectangle,
      },
      zOrder: ['shape-key'],
      groups: {
        'group-key': {
          id: 'different-group-id',
          shapeIds: ['shape-key', 'shape-key'],
        },
      },
    } as unknown as EditorDocument;

    expect(issueCodes(invalidDocument)).toEqual([
      'unsupported-format-version',
      'shape-id-mismatch',
      'group-id-mismatch',
      'duplicate-group-member',
    ]);
  });
});
