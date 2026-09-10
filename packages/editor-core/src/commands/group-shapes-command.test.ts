import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
  type EditorShape,
} from '../model.js';
import { isDocumentValid } from '../validation.js';
import { GroupShapesCommand, UngroupShapesCommand } from './index.js';

/**
 * Focused tests for {@link GroupShapesCommand}'s "one level only" rule
 * (spec §7, issue #52): grouping a selection that overlaps an existing group
 * dissolves that group instead of throwing. `commands.test.ts` keeps the
 * original round-trip / error-path coverage; this file drills into the
 * dissolve-and-fold behaviour with a document large enough (four shapes) to
 * exercise multiple pre-existing groups at once.
 */

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

const baseDocument = (): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: {
    'shape-a': rectangle('shape-a', 0),
    'shape-b': rectangle('shape-b', 6),
    'shape-c': rectangle('shape-c', 12),
    'shape-d': rectangle('shape-d', 18),
  },
  zOrder: ['shape-a', 'shape-b', 'shape-c', 'shape-d'],
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 22, y: 3 } },
});

describe('GroupShapesCommand nesting rule', () => {
  it('test_apply_noExistingGroups_createsGroupUnchanged', () => {
    const applied = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    expect(Object.keys(applied.groups)).toEqual(['group-1']);
    expect(isDocumentValid(applied)).toBe(true);
  });

  it('test_apply_oneShapeAlreadyGrouped_dissolvesThatGroup', () => {
    // shape-a and shape-b start in group-1; regroup shape-b with shape-c.
    const grouped = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    const regrouped = new GroupShapesCommand('group-2', ['shape-b', 'shape-c']).apply(grouped);

    expect(regrouped.groups['group-1']).toBeUndefined();
    expect(regrouped.groups['group-2']?.shapeIds).toEqual(['shape-b', 'shape-c']);
    // shape-a is left ungrouped — it wasn't part of the new selection, and a
    // group can't have fewer than two members, so it can't linger alone.
    expect(
      Object.values(regrouped.groups).some((group) => group.shapeIds.includes('shape-a'))
    ).toBe(false);
  });

  it('test_apply_selectionSpansTwoExistingGroups_dissolvesBoth', () => {
    // group-1: {a, b}, group-2: {c, d}. Regroup one member of each.
    let document = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    document = new GroupShapesCommand('group-2', ['shape-c', 'shape-d']).apply(document);

    const regrouped = new GroupShapesCommand('group-3', ['shape-b', 'shape-c']).apply(document);

    expect(regrouped.groups['group-1']).toBeUndefined();
    expect(regrouped.groups['group-2']).toBeUndefined();
    expect(regrouped.groups['group-3']?.shapeIds).toEqual(['shape-b', 'shape-c']);
    expect(Object.keys(regrouped.groups)).toEqual(['group-3']);
  });

  it('test_apply_wholeExistingGroupReselected_replacesItWithNewId', () => {
    const grouped = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    const regrouped = new GroupShapesCommand('group-2', ['shape-a', 'shape-b']).apply(grouped);
    expect(Object.keys(regrouped.groups)).toEqual(['group-2']);
    expect(regrouped.groups['group-2']?.shapeIds).toEqual(['shape-a', 'shape-b']);
  });

  it('test_invert_selectionSpansTwoExistingGroups_restoresBothOnUndo', () => {
    let document = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    document = new GroupShapesCommand('group-2', ['shape-c', 'shape-d']).apply(document);

    const command = new GroupShapesCommand('group-3', ['shape-b', 'shape-c']);
    const inverse = command.invert(document);
    const applied = command.apply(document);
    const undone = inverse.apply(applied);

    expect(undone).toEqual(document);
    expect(undone.groups['group-1']?.shapeIds).toEqual(['shape-a', 'shape-b']);
    expect(undone.groups['group-2']?.shapeIds).toEqual(['shape-c', 'shape-d']);

    const redone = command.apply(undone);
    expect(redone).toEqual(applied);
  });

  it('test_invert_noExistingGroupDissolved_isPlainUngroup', () => {
    const command = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']);
    const inverse = command.invert(baseDocument());
    expect(inverse).toBeInstanceOf(UngroupShapesCommand);
  });

  it('test_apply_neverProducesNestedGroups_everyShapeBelongsToAtMostOneGroup', () => {
    let document = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    document = new GroupShapesCommand('group-2', ['shape-b', 'shape-c']).apply(document);
    document = new GroupShapesCommand('group-3', ['shape-a', 'shape-c', 'shape-d']).apply(document);

    const membership = new Map<string, number>();
    for (const group of Object.values(document.groups)) {
      for (const shapeId of group.shapeIds) {
        membership.set(shapeId, (membership.get(shapeId) ?? 0) + 1);
      }
    }
    for (const count of membership.values()) {
      expect(count).toBe(1);
    }
    expect(isDocumentValid(document)).toBe(true);
  });
});
