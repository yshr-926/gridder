import { describe, expect, it } from 'vitest';

import { CURRENT_DOCUMENT_FORMAT_VERSION, DEFAULT_ANNOTATION_FONT_SIZE, type EditorDocument, type EditorShape } from '../model.js';
import { DocumentDeserializationError } from './errors.js';
import { deserializeDocument, serializeDocument } from './document-serialization.js';

const rectangle = (id: string, offsetX: number): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: offsetX, y: 0 },
      { x: offsetX + 4, y: 0 },
      { x: offsetX + 4, y: 3 },
      { x: offsetX, y: 3 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
  name: id,
});

const shapeWithHole = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 },
    ],
    innerRings: [
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 1, y: 2 },
      ],
    ],
  },
  style: { fill: '#22c55e', opacity: 1, isBorderVisible: true },
});

const baseDocument = (): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: {
    'shape-a': rectangle('shape-a', 0),
    'shape-b': shapeWithHole('shape-b'),
  },
  zOrder: ['shape-a', 'shape-b'],
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 9, y: 5 } },
  physicalScale: { valuePerCell: 10, unit: 'cm' },
});

describe('serializeDocument / deserializeDocument', () => {
  it('test_roundTrip_serializeThenDeserialize_matchesOriginalExactly', () => {
    const document = baseDocument();
    const roundTripped = deserializeDocument(serializeDocument(document));
    expect(roundTripped).toEqual(document);
  });

  it('test_roundTrip_documentWithGroupsAndNoPhysicalScale_matchesExactly', () => {
    const document: EditorDocument = {
      formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
      annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
      shapes: {
        'shape-a': rectangle('shape-a', 0),
        'shape-b': rectangle('shape-b', 6),
      },
      zOrder: ['shape-a', 'shape-b'],
      groups: { 'group-1': { id: 'group-1', shapeIds: ['shape-a', 'shape-b'] } },
      drawingBounds: { mode: 'manual', min: { x: -2, y: -2 }, max: { x: 12, y: 6 } },
    };
    const roundTripped = deserializeDocument(serializeDocument(document));
    expect(roundTripped).toEqual(document);
  });

  it('test_serializeDocument_omitsUndoHistory_onlyDocumentFieldsPresent', () => {
    const document = baseDocument();
    const json = JSON.parse(serializeDocument(document)) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(
      [
        'annotationFontSize',
        'drawingBounds',
        'formatVersion',
        'groups',
        'physicalScale',
        'shapes',
        'zOrder',
      ].sort(),
    );
  });

  it('test_deserializeDocument_invalidJson_throwsWithInvalidJsonCode', () => {
    expect(() => deserializeDocument('{not json')).toThrow(DocumentDeserializationError);
    try {
      deserializeDocument('{not json');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      expect((error as DocumentDeserializationError).code).toBe('invalid-json');
    }
  });

  it('test_deserializeDocument_notAnObject_throwsWithMalformedDocumentCode', () => {
    try {
      deserializeDocument(JSON.stringify([1, 2, 3]));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      expect((error as DocumentDeserializationError).code).toBe('malformed-document');
    }
  });

  it('test_deserializeDocument_missingField_throwsWithMalformedDocumentCode', () => {
    const document: Record<string, unknown> = { ...baseDocument() };
    delete document.zOrder;
    try {
      deserializeDocument(JSON.stringify(document));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      expect((error as DocumentDeserializationError).code).toBe('malformed-document');
    }
  });

  it('test_deserializeDocument_unknownFormatVersion_throwsWithUnsupportedFormatVersionCode', () => {
    const document = { ...baseDocument(), formatVersion: 999 };
    try {
      deserializeDocument(JSON.stringify(document));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      expect((error as DocumentDeserializationError).code).toBe('unsupported-format-version');
    }
  });

  it('test_deserializeDocument_formatVersion1_throwsWithUnsupportedFormatVersionCode', () => {
    // A pre-#66 file: version 1 and no `annotationFontSize`. Spec §9 offers
    // no migration, so it is refused by version before its shape is judged.
    const document: Record<string, unknown> = { ...baseDocument(), formatVersion: 1 };
    delete document.annotationFontSize;
    try {
      deserializeDocument(JSON.stringify(document));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      expect((error as DocumentDeserializationError).code).toBe('unsupported-format-version');
    }
  });

  it('test_deserializeDocument_missingAnnotationFontSize_throwsWithMalformedDocumentCode', () => {
    const document: Record<string, unknown> = { ...baseDocument() };
    delete document.annotationFontSize;
    try {
      deserializeDocument(JSON.stringify(document));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      expect((error as DocumentDeserializationError).code).toBe('malformed-document');
    }
  });

  it('test_deserializeDocument_outOfRangeAnnotationFontSize_throwsWithInvalidDocumentCode', () => {
    const document = { ...baseDocument(), annotationFontSize: 40 };
    try {
      deserializeDocument(JSON.stringify(document));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      expect((error as DocumentDeserializationError).code).toBe('invalid-document');
      expect((error as DocumentDeserializationError).issues.map((issue) => issue.code)).toEqual([
        'invalid-annotation-font-size',
      ]);
    }
  });

  it('test_deserializeDocument_nonIntegerVertex_throwsWithInvalidDocumentCode_andIssues', () => {
    const document = baseDocument();
    const broken = {
      ...document,
      shapes: {
        ...document.shapes,
        'shape-a': {
          ...document.shapes['shape-a'],
          polygon: {
            outerRing: [
              { x: 0.5, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 3 },
              { x: 0, y: 3 },
            ],
            innerRings: [],
          },
        },
      },
    };
    try {
      deserializeDocument(JSON.stringify(broken));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      const deserializationError = error as DocumentDeserializationError;
      expect(deserializationError.code).toBe('invalid-document');
      expect(deserializationError.issues.some((issue) => issue.code === 'non-integer-coordinate')).toBe(
        true,
      );
    }
  });

  it('test_deserializeDocument_shapeMissingRequiredField_throwsWithMalformedDocumentCode', () => {
    const document = baseDocument();
    const shapeWithoutStyle: Record<string, unknown> = { ...document.shapes['shape-a'] };
    delete shapeWithoutStyle.style;
    const broken = {
      ...document,
      shapes: { ...document.shapes, 'shape-a': shapeWithoutStyle },
    };
    try {
      deserializeDocument(JSON.stringify(broken));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentDeserializationError);
      expect((error as DocumentDeserializationError).code).toBe('malformed-document');
    }
  });
});
