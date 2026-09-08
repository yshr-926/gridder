import { describe, expect, it } from 'vitest';

import { createPolygonClippingEngine } from '../boolean/index.js';
import { polygonKey } from '../boolean/test-helpers.js';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  type GridPolygon,
} from '../model.js';
import { isDocumentValid } from '../validation.js';
import { DocumentHistory } from '../history/index.js';
import {
  CombineShapesCommand,
  CommandApplicationError,
  SubtractShapesCommand,
  frontmostShapeId,
  unionOfShapes,
} from './index.js';

const engine = createPolygonClippingEngine();

const rectPolygon = (minX: number, minY: number, maxX: number, maxY: number): GridPolygon => ({
  outerRing: [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ],
  innerRings: [],
});

const rect = (
  id: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  extra: Partial<Pick<EditorShape, 'name' | 'style'>> = {},
): EditorShape => ({
  id,
  polygon: rectPolygon(minX, minY, maxX, maxY),
  style: extra.style ?? { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
  ...(extra.name === undefined ? {} : { name: extra.name }),
});

/** Shapes listed back to front. */
const documentOf = (
  shapes: readonly EditorShape[],
  groups: EditorDocument['groups'] = {},
): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups,
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 20, y: 20 } },
});

/** apply → undo → redo must reproduce the applied document exactly (spec §11). */
const expectRoundTrip = (document: EditorDocument, command: CombineShapesCommand | SubtractShapesCommand) => {
  const history = new DocumentHistory(document);
  const applied = history.dispatch(command);
  expect(isDocumentValid(applied)).toBe(true);
  expect(history.undo()).toEqual(document);
  expect(history.redo()).toEqual(applied);
  return applied;
};

describe('frontmostShapeId', () => {
  it('test_frontmostShapeId_returnsTheIdWithTheHighestZOrderSlot', () => {
    const document = documentOf([rect('back', 0, 0, 1, 1), rect('mid', 0, 0, 1, 1), rect('front', 0, 0, 1, 1)]);
    expect(frontmostShapeId(document, ['back', 'front', 'mid'])).toBe('front');
    expect(frontmostShapeId(document, ['mid', 'back'])).toBe('mid');
  });
});

describe('unionOfShapes', () => {
  it('test_unionOfShapes_edgeSharingRects_isOneConnectedPolygon', () => {
    const document = documentOf([rect('a', 0, 0, 3, 3), rect('b', 3, 0, 4, 1)]);
    expect(unionOfShapes(document, ['a', 'b'], engine)).toHaveLength(1);
  });

  it('test_unionOfShapes_separatedRects_isMoreThanOnePolygon', () => {
    const document = documentOf([rect('a', 0, 0, 3, 3), rect('b', 5, 0, 8, 3)]);
    expect(unionOfShapes(document, ['a', 'b'], engine)).toHaveLength(2);
  });

  it('test_unionOfShapes_cornerTouchingRects_isMoreThanOnePolygon', () => {
    const document = documentOf([rect('a', 0, 0, 2, 2), rect('b', 2, 2, 4, 4)]);
    expect(unionOfShapes(document, ['a', 'b'], engine)).toHaveLength(2);
  });
});

describe('CombineShapesCommand', () => {
  it('test_CombineShapesCommand_twoEdgeSharingRects_becomeOneLShape_keepingTheFrontmost', () => {
    const document = documentOf([
      rect('back', 0, 0, 3, 3, { name: 'back name' }),
      rect('front', 3, 0, 4, 1, {
        name: 'front name',
        style: { fill: '#ef4444', opacity: 1, isBorderVisible: false },
      }),
    ]);

    const applied = expectRoundTrip(document, new CombineShapesCommand(['back', 'front'], engine));

    expect(applied.zOrder).toEqual(['front']);
    const merged = applied.shapes['front'] as EditorShape;
    expect(merged.name).toBe('front name');
    expect(merged.style).toEqual({ fill: '#ef4444', opacity: 1, isBorderVisible: false });
    expect(polygonKey(merged.polygon)).toBe(
      polygonKey({
        outerRing: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 1 },
          { x: 3, y: 1 },
          { x: 3, y: 3 },
          { x: 0, y: 3 },
        ],
        innerRings: [],
      }),
    );
  });

  it('test_CombineShapesCommand_keeperKeepsItsZOrderSlot_amongUnrelatedShapes', () => {
    const document = documentOf([
      rect('below', 10, 10, 11, 11),
      rect('a', 0, 0, 2, 2),
      rect('above', 12, 12, 13, 13),
      rect('b', 1, 1, 3, 3),
      rect('top', 14, 14, 15, 15),
    ]);

    const applied = expectRoundTrip(document, new CombineShapesCommand(['a', 'b'], engine));

    expect(applied.zOrder).toEqual(['below', 'above', 'b', 'top']);
  });

  it('test_CombineShapesCommand_threeOverlappingShapes_collapseToOne', () => {
    const document = documentOf([rect('a', 0, 0, 2, 2), rect('b', 1, 0, 3, 2), rect('c', 2, 0, 4, 2)]);

    const applied = expectRoundTrip(document, new CombineShapesCommand(['a', 'b', 'c'], engine));

    expect(applied.zOrder).toEqual(['c']);
    expect(polygonKey((applied.shapes['c'] as EditorShape).polygon)).toBe(polygonKey(rectPolygon(0, 0, 4, 2)));
  });

  it('test_CombineShapesCommand_separatedShapes_isRefused_documentUntouched', () => {
    const document = documentOf([rect('a', 0, 0, 3, 3), rect('b', 5, 0, 8, 3)]);
    const history = new DocumentHistory(document);

    expect(() => history.dispatch(new CombineShapesCommand(['a', 'b'], engine))).toThrow(
      CommandApplicationError,
    );
    expect(history.getDocument()).toBe(document);
    expect(history.canUndo).toBe(false);
  });

  it('test_CombineShapesCommand_fewerThanTwoShapes_isRefused', () => {
    const document = documentOf([rect('a', 0, 0, 3, 3)]);
    expect(() => new CombineShapesCommand(['a'], engine).apply(document)).toThrow(CommandApplicationError);
  });

  it('test_CombineShapesCommand_wholeGroupCombined_dissolvesTheGroup_undoRestoresIt', () => {
    const document = documentOf([rect('a', 0, 0, 2, 2), rect('b', 2, 0, 4, 2)], {
      'group-1': { id: 'group-1', shapeIds: ['a', 'b'] },
    });

    const applied = expectRoundTrip(document, new CombineShapesCommand(['a', 'b'], engine));

    expect(applied.groups).toEqual({});
  });
});

describe('SubtractShapesCommand', () => {
  it('test_SubtractShapesCommand_cutterInsideSubject_leavesOneShapeWithAHole_andDeletesTheCutter', () => {
    const document = documentOf([rect('subject', 0, 0, 4, 4), rect('cutter', 1, 1, 2, 2)]);

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['subject', 'cutter'], engine));

    expect(applied.zOrder).toEqual(['subject']);
    const carved = applied.shapes['subject'] as EditorShape;
    expect(carved.polygon.innerRings).toHaveLength(1);
    expect(polygonKey(carved.polygon)).toBe(
      polygonKey({
        outerRing: rectPolygon(0, 0, 4, 4).outerRing,
        innerRings: [
          [
            { x: 1, y: 1 },
            { x: 1, y: 2 },
            { x: 2, y: 2 },
            { x: 2, y: 1 },
          ],
        ],
      }),
    );
  });

  it('test_SubtractShapesCommand_cutterAtTheEdge_leavesOneConcaveShape', () => {
    const document = documentOf([rect('subject', 0, 0, 4, 4), rect('cutter', 3, 1, 5, 2)]);

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['subject', 'cutter'], engine));

    expect(applied.zOrder).toEqual(['subject']);
    const carved = applied.shapes['subject'] as EditorShape;
    expect(carved.polygon.innerRings).toHaveLength(0);
    expect(carved.polygon.outerRing).toHaveLength(8);
  });

  it('test_SubtractShapesCommand_cutterDisconnectsSubject_splitsIntoTwoShapes_inheritingNameStyleAndSlot', () => {
    const style = { fill: '#22c55e' as const, opacity: 0.5, isBorderVisible: true };
    const document = documentOf([
      rect('below', 10, 10, 11, 11),
      rect('subject', 0, 0, 5, 2, { name: 'bar', style }),
      rect('above', 12, 12, 13, 13),
      rect('cutter', 2, 0, 3, 2),
    ]);

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['subject', 'cutter'], engine));

    expect(applied.zOrder).toEqual(['below', 'subject', 'subject-2', 'above']);
    const pieces = [applied.shapes['subject'], applied.shapes['subject-2']] as EditorShape[];
    for (const piece of pieces) {
      expect(piece.name).toBe('bar');
      expect(piece.style).toEqual(style);
    }
    expect(pieces.map((piece) => polygonKey(piece.polygon)).sort()).toEqual(
      [polygonKey(rectPolygon(0, 0, 2, 2)), polygonKey(rectPolygon(3, 0, 5, 2))].sort(),
    );
  });

  it('test_SubtractShapesCommand_derivedPieceIds_skipIdsAlreadyInUse_andAreStableOnRedo', () => {
    const document = documentOf([
      rect('subject', 0, 0, 5, 2),
      rect('subject-2', 10, 10, 11, 11),
      rect('cutter', 2, 0, 3, 2),
    ]);

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['subject', 'cutter'], engine));

    expect(applied.zOrder).toEqual(['subject', 'subject-3', 'subject-2']);
  });

  it('test_SubtractShapesCommand_subjectFullyCovered_isDeleted', () => {
    const document = documentOf([rect('subject', 1, 1, 2, 2), rect('cutter', 0, 0, 4, 4)]);

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['subject', 'cutter'], engine));

    expect(applied.zOrder).toEqual([]);
  });

  it('test_SubtractShapesCommand_cutterNotTouchingSubject_stillConsumesTheCutter', () => {
    const document = documentOf([rect('subject', 0, 0, 2, 2), rect('cutter', 5, 5, 6, 6)]);

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['subject', 'cutter'], engine));

    expect(applied.zOrder).toEqual(['subject']);
    expect(applied.shapes['subject']).toEqual(document.shapes['subject']);
  });

  it('test_SubtractShapesCommand_frontmostIsTheCutter_regardlessOfSelectionOrder', () => {
    const document = documentOf([rect('a', 0, 0, 4, 4), rect('b', 1, 1, 2, 2)]);

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['b', 'a'], engine));

    expect(applied.zOrder).toEqual(['a']);
    expect((applied.shapes['a'] as EditorShape).polygon.innerRings).toHaveLength(1);
  });

  it('test_SubtractShapesCommand_severalSubjects_eachLosesTheCutter', () => {
    const document = documentOf([rect('a', 0, 0, 4, 2), rect('b', 0, 2, 4, 4), rect('cutter', 1, 1, 3, 3)]);

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['a', 'b', 'cutter'], engine));

    expect(applied.zOrder).toEqual(['a', 'b']);
    expect((applied.shapes['a'] as EditorShape).polygon.outerRing).toHaveLength(8);
    expect((applied.shapes['b'] as EditorShape).polygon.outerRing).toHaveLength(8);
  });

  it('test_SubtractShapesCommand_splitPiecesJoinTheSubjectsGroup_undoRestoresMembership', () => {
    const document = documentOf(
      [rect('subject', 0, 0, 5, 2), rect('other', 10, 10, 11, 11), rect('cutter', 2, 0, 3, 2)],
      { 'group-1': { id: 'group-1', shapeIds: ['subject', 'other'] } },
    );

    const applied = expectRoundTrip(document, new SubtractShapesCommand(['subject', 'cutter'], engine));

    expect(applied.groups['group-1']?.shapeIds).toEqual(['subject', 'other', 'subject-2']);
  });

  it('test_SubtractShapesCommand_fewerThanTwoShapes_isRefused', () => {
    const document = documentOf([rect('a', 0, 0, 3, 3)]);
    expect(() => new SubtractShapesCommand(['a'], engine).apply(document)).toThrow(CommandApplicationError);
  });

  it('test_SubtractShapesCommand_unknownShape_isRefused', () => {
    const document = documentOf([rect('a', 0, 0, 3, 3)]);
    expect(() => new SubtractShapesCommand(['a', 'missing'], engine).apply(document)).toThrow();
  });
});
