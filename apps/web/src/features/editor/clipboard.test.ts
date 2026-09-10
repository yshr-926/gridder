import { afterEach, describe, expect, it } from 'vitest';
import type { EditorShape } from '@gridder/editor-core';
import { clearClipboardForTests, copyToClipboard, notePasted, readClipboard } from './clipboard';

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

describe('clipboard', () => {
  afterEach(clearClipboardForTests);

  it('test_readClipboard_beforeAnyCopy_isNull', () => {
    expect(readClipboard()).toBeNull();
  });

  it('test_copyToClipboard_storesShapes_withPasteCountZero', () => {
    copyToClipboard([rectShape('a')]);
    expect(readClipboard()).toEqual({ shapes: [rectShape('a')], groupings: [], pasteCount: 0 });
  });

  it('test_copyToClipboard_storesGroupings_alongsideTheShapes', () => {
    copyToClipboard([rectShape('a'), rectShape('b')], [['a', 'b']]);
    expect(readClipboard()?.groupings).toEqual([['a', 'b']]);
  });

  it('test_copyToClipboard_withoutGroupings_defaultsToNone', () => {
    copyToClipboard([rectShape('a')]);
    expect(readClipboard()?.groupings).toEqual([]);
  });

  it('test_copyToClipboard_emptyList_leavesClipboardUnchanged', () => {
    copyToClipboard([rectShape('a')]);
    copyToClipboard([]);
    expect(readClipboard()?.shapes).toHaveLength(1);
  });

  it('test_notePasted_incrementsPasteCount', () => {
    copyToClipboard([rectShape('a')]);
    notePasted();
    notePasted();
    expect(readClipboard()?.pasteCount).toBe(2);
  });

  it('test_copyToClipboard_afterPreviousCopy_resetsPasteCount', () => {
    copyToClipboard([rectShape('a')], [['a', 'b']]);
    notePasted();
    copyToClipboard([rectShape('b')]);
    expect(readClipboard()).toEqual({ shapes: [rectShape('b')], groupings: [], pasteCount: 0 });
  });

  it('test_notePasted_withEmptyClipboard_isNoOp', () => {
    notePasted();
    expect(readClipboard()).toBeNull();
  });
});
