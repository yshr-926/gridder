import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  MAX_ANNOTATION_FONT_SIZE,
  MIN_ANNOTATION_FONT_SIZE,
  type EditorDocument,
} from '../model.js';
import { isDocumentValid } from '../validation.js';
import { CommandApplicationError, SetAnnotationFontSizeCommand } from './index.js';

const baseDocument = (annotationFontSize = DEFAULT_ANNOTATION_FONT_SIZE): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize,
  shapes: {},
  zOrder: [],
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
});

describe('SetAnnotationFontSizeCommand', () => {
  it('test_apply_setsAnnotationFontSize_andKeepsDocumentValid', () => {
    const document = baseDocument();

    const applied = new SetAnnotationFontSizeCommand(16).apply(document);

    expect(applied.annotationFontSize).toBe(16);
    expect(isDocumentValid(applied)).toBe(true);
    expect(document.annotationFontSize).toBe(DEFAULT_ANNOTATION_FONT_SIZE);
  });

  it('test_apply_acceptsRangeBounds', () => {
    const document = baseDocument();

    expect(new SetAnnotationFontSizeCommand(MIN_ANNOTATION_FONT_SIZE).apply(document).annotationFontSize).toBe(
      MIN_ANNOTATION_FONT_SIZE,
    );
    expect(new SetAnnotationFontSizeCommand(MAX_ANNOTATION_FONT_SIZE).apply(document).annotationFontSize).toBe(
      MAX_ANNOTATION_FONT_SIZE,
    );
  });

  it('test_apply_outOfRange_throwsCommandApplicationError', () => {
    const document = baseDocument();

    expect(() => new SetAnnotationFontSizeCommand(MIN_ANNOTATION_FONT_SIZE - 1).apply(document)).toThrow(
      CommandApplicationError,
    );
    expect(() => new SetAnnotationFontSizeCommand(MAX_ANNOTATION_FONT_SIZE + 1).apply(document)).toThrow(
      CommandApplicationError,
    );
  });

  it('test_apply_fractional_throwsCommandApplicationError', () => {
    expect(() => new SetAnnotationFontSizeCommand(12.5).apply(baseDocument())).toThrow(
      CommandApplicationError,
    );
  });

  it('test_invert_undoesToDocumentsPreviousSize', () => {
    const document = baseDocument(10);
    const command = new SetAnnotationFontSizeCommand(24);

    const inverse = command.invert(document);
    const applied = command.apply(document);
    const undone = inverse.apply(applied);

    expect(undone).toEqual(document);
  });

  it('test_applyThenRedo_matchesOriginalApply', () => {
    const document = baseDocument();
    const command = new SetAnnotationFontSizeCommand(20);

    const inverse = command.invert(document);
    const applied = command.apply(document);
    const undone = inverse.apply(applied);
    const redone = command.apply(undone);

    expect(redone).toEqual(applied);
  });
});
