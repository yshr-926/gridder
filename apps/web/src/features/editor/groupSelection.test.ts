import { describe, expect, it } from 'vitest';
import { CURRENT_DOCUMENT_FORMAT_VERSION, type EditorDocument, type EditorShape } from '@gridder/editor-core';
import {
  expandSelectionForGroups,
  groupContaining,
  resolveClickSelection,
  resolveDoubleClickTarget,
} from './groupSelection';

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const documentWith = (
  shapeIds: readonly string[],
  groups: Record<string, readonly string[]> = {},
): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: Object.fromEntries(shapeIds.map((id) => [id, rectShape(id)])),
  zOrder: [...shapeIds],
  groups: Object.fromEntries(
    Object.entries(groups).map(([groupId, memberIds]) => [
      groupId,
      { id: groupId, shapeIds: memberIds },
    ]),
  ),
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
});

describe('groupContaining', () => {
  it('test_groupContaining_shapeInGroup_returnsGroup', () => {
    const document = documentWith(['a', 'b', 'c'], { 'group-1': ['a', 'b'] });
    expect(groupContaining(document, 'a')?.id).toBe('group-1');
  });

  it('test_groupContaining_ungroupedShape_returnsNull', () => {
    const document = documentWith(['a', 'b', 'c'], { 'group-1': ['a', 'b'] });
    expect(groupContaining(document, 'c')).toBeNull();
  });
});

describe('expandSelectionForGroups', () => {
  it('test_expandSelectionForGroups_ungroupedShape_isUnchanged', () => {
    const document = documentWith(['a', 'b']);
    expect(expandSelectionForGroups(document, ['a'], null)).toEqual(['a']);
  });

  it('test_expandSelectionForGroups_groupedShape_expandsToWholeGroup', () => {
    const document = documentWith(['a', 'b', 'c'], { 'group-1': ['a', 'b'] });
    expect(expandSelectionForGroups(document, ['a'], null)).toEqual(['a', 'b']);
  });

  it('test_expandSelectionForGroups_activeGroup_leavesItsMembersUnexpanded', () => {
    const document = documentWith(['a', 'b', 'c'], { 'group-1': ['a', 'b'] });
    expect(expandSelectionForGroups(document, ['a'], 'group-1')).toEqual(['a']);
  });

  it('test_expandSelectionForGroups_multipleShapesAcrossGroups_expandsEach_dedup', () => {
    const document = documentWith(['a', 'b', 'c', 'd'], {
      'group-1': ['a', 'b'],
      'group-2': ['c', 'd'],
    });
    expect(expandSelectionForGroups(document, ['a', 'c'], null)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('test_expandSelectionForGroups_bothMembersAlreadyGiven_noDuplicates', () => {
    const document = documentWith(['a', 'b'], { 'group-1': ['a', 'b'] });
    expect(expandSelectionForGroups(document, ['a', 'b'], null)).toEqual(['a', 'b']);
  });
});

describe('resolveClickSelection', () => {
  it('test_resolveClickSelection_ungroupedShape_selectsItAlone_exitsGroupMode', () => {
    const document = documentWith(['a', 'b']);
    const result = resolveClickSelection(document, 'group-1', 'a');
    expect(result).toEqual({ shapeIds: ['a'], activeGroupId: null });
  });

  it('test_resolveClickSelection_differentGroupMember_selectsWholeGroup_exitsPreviousGroupMode', () => {
    const document = documentWith(['a', 'b', 'c', 'd'], {
      'group-1': ['a', 'b'],
      'group-2': ['c', 'd'],
    });
    const result = resolveClickSelection(document, 'group-1', 'c');
    expect(result).toEqual({ shapeIds: ['c', 'd'], activeGroupId: null });
  });

  it('test_resolveClickSelection_memberOfActiveGroup_selectsItAlone_staysInGroupMode', () => {
    const document = documentWith(['a', 'b'], { 'group-1': ['a', 'b'] });
    const result = resolveClickSelection(document, 'group-1', 'b');
    expect(result).toEqual({ shapeIds: ['b'], activeGroupId: 'group-1' });
  });

  it('test_resolveClickSelection_noActiveGroup_groupedShape_selectsWholeGroup', () => {
    const document = documentWith(['a', 'b'], { 'group-1': ['a', 'b'] });
    const result = resolveClickSelection(document, null, 'a');
    expect(result).toEqual({ shapeIds: ['a', 'b'], activeGroupId: null });
  });
});

describe('resolveDoubleClickTarget', () => {
  it('test_resolveDoubleClickTarget_groupedShape_notActive_entersGroup', () => {
    const document = documentWith(['a', 'b'], { 'group-1': ['a', 'b'] });
    expect(resolveDoubleClickTarget(document, null, 'a')).toBe('enter-group');
  });

  it('test_resolveDoubleClickTarget_groupedShape_alreadyActive_doesNothing', () => {
    const document = documentWith(['a', 'b'], { 'group-1': ['a', 'b'] });
    expect(resolveDoubleClickTarget(document, 'group-1', 'a')).toBe('none');
  });

  it('test_resolveDoubleClickTarget_ungroupedShape_doesNothing', () => {
    const document = documentWith(['a', 'b']);
    expect(resolveDoubleClickTarget(document, null, 'a')).toBe('none');
  });

  it('test_resolveDoubleClickTarget_memberOfDifferentGroup_entersThatGroup', () => {
    const document = documentWith(['a', 'b', 'c', 'd'], {
      'group-1': ['a', 'b'],
      'group-2': ['c', 'd'],
    });
    expect(resolveDoubleClickTarget(document, 'group-1', 'c')).toBe('enter-group');
  });
});
