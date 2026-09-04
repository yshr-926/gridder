import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearPhysicalScale, setPhysicalScale } from './physicalScaleCommands';
import { editorSession } from './useEditorSession';

const reset = () => {
  while (editorSession.canUndo) {
    editorSession.undo();
  }
};

describe('setPhysicalScale', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_setPhysicalScale_setsScale_onTheDocument', () => {
    setPhysicalScale(10, 'cm');
    expect(editorSession.getDocument().physicalScale).toEqual({ valuePerCell: 10, unit: 'cm' });
  });

  it('test_setPhysicalScale_isUndoable', () => {
    setPhysicalScale(10, 'cm');
    editorSession.undo();
    expect(editorSession.getDocument().physicalScale).toBeUndefined();
  });

  it('test_setPhysicalScale_zeroValue_isNoOp', () => {
    const before = editorSession.getDocument();
    setPhysicalScale(0, 'cm');
    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_setPhysicalScale_negativeValue_isNoOp', () => {
    const before = editorSession.getDocument();
    setPhysicalScale(-5, 'cm');
    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_setPhysicalScale_nonFiniteValue_isNoOp', () => {
    const before = editorSession.getDocument();
    setPhysicalScale(Number.NaN, 'cm');
    expect(editorSession.getDocument()).toBe(before);
  });
});

describe('clearPhysicalScale', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_clearPhysicalScale_removesScale', () => {
    setPhysicalScale(10, 'cm');
    clearPhysicalScale();
    expect(editorSession.getDocument().physicalScale).toBeUndefined();
  });

  it('test_clearPhysicalScale_isUndoable', () => {
    setPhysicalScale(10, 'cm');
    clearPhysicalScale();
    editorSession.undo();
    expect(editorSession.getDocument().physicalScale).toEqual({ valuePerCell: 10, unit: 'cm' });
  });
});
