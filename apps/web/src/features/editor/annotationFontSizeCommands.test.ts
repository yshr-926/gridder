import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ANNOTATION_FONT_SIZE } from '@gridder/editor-core';
import { setAnnotationFontSize } from './annotationFontSizeCommands';
import { editorSession } from './useEditorSession';

const reset = () => {
  while (editorSession.canUndo) {
    editorSession.undo();
  }
};

describe('setAnnotationFontSize', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_setAnnotationFontSize_setsSize_onTheDocument', () => {
    setAnnotationFontSize(16);
    expect(editorSession.getDocument().annotationFontSize).toBe(16);
  });

  it('test_setAnnotationFontSize_isUndoable', () => {
    setAnnotationFontSize(16);
    editorSession.undo();
    expect(editorSession.getDocument().annotationFontSize).toBe(DEFAULT_ANNOTATION_FONT_SIZE);
  });

  it('test_setAnnotationFontSize_sameAsCurrent_isNoOp', () => {
    const before = editorSession.getDocument();
    setAnnotationFontSize(before.annotationFontSize);
    expect(editorSession.getDocument()).toBe(before);
    expect(editorSession.canUndo).toBe(false);
  });

  it('test_setAnnotationFontSize_outOfRange_isNoOp', () => {
    const before = editorSession.getDocument();
    setAnnotationFontSize(7);
    setAnnotationFontSize(33);
    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_setAnnotationFontSize_fractional_isNoOp', () => {
    const before = editorSession.getDocument();
    setAnnotationFontSize(12.5);
    expect(editorSession.getDocument()).toBe(before);
  });

  it('test_setAnnotationFontSize_nonFinite_isNoOp', () => {
    const before = editorSession.getDocument();
    setAnnotationFontSize(Number.NaN);
    expect(editorSession.getDocument()).toBe(before);
  });
});
