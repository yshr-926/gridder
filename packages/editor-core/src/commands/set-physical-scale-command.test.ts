import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
  type PhysicalScale,
} from '../model.js';
import { isDocumentValid } from '../validation.js';
import { SetPhysicalScaleCommand } from './index.js';

const baseDocument = (physicalScale?: PhysicalScale): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: {},
  zOrder: [],
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
  ...(physicalScale !== undefined ? { physicalScale } : {}),
});

describe('SetPhysicalScaleCommand', () => {
  it('test_apply_noExistingScale_setsPhysicalScale', () => {
    const document = baseDocument();
    const scale: PhysicalScale = { valuePerCell: 10, unit: 'cm' };

    const applied = new SetPhysicalScaleCommand(scale).apply(document);

    expect(applied.physicalScale).toEqual(scale);
    expect(isDocumentValid(applied)).toBe(true);
  });

  it('test_apply_replacesExistingScale', () => {
    const document = baseDocument({ valuePerCell: 10, unit: 'cm' });
    const nextScale: PhysicalScale = { valuePerCell: 1, unit: 'm' };

    const applied = new SetPhysicalScaleCommand(nextScale).apply(document);

    expect(applied.physicalScale).toEqual(nextScale);
  });

  it('test_apply_undefined_clearsExistingScale', () => {
    const document = baseDocument({ valuePerCell: 10, unit: 'cm' });

    const applied = new SetPhysicalScaleCommand(undefined).apply(document);

    expect(applied.physicalScale).toBeUndefined();
    expect('physicalScale' in applied).toBe(false);
  });

  it('test_invert_undoesToDocumentsPreviousScale', () => {
    const document = baseDocument({ valuePerCell: 10, unit: 'cm' });
    const command = new SetPhysicalScaleCommand({ valuePerCell: 5, unit: 'mm' });

    const inverse = command.invert(document);
    const applied = command.apply(document);
    const undone = inverse.apply(applied);

    expect(undone).toEqual(document);
  });

  it('test_invert_undoesClearingBackToPreviousScale', () => {
    const document = baseDocument({ valuePerCell: 10, unit: 'cm' });
    const command = new SetPhysicalScaleCommand(undefined);

    const inverse = command.invert(document);
    const applied = command.apply(document);
    const undone = inverse.apply(applied);

    expect(undone).toEqual(document);
    expect(undone.physicalScale).toEqual({ valuePerCell: 10, unit: 'cm' });
  });

  it('test_invert_fromNoScale_undoesBackToNoScale', () => {
    const document = baseDocument();
    const command = new SetPhysicalScaleCommand({ valuePerCell: 20, unit: 'mm' });

    const inverse = command.invert(document);
    const applied = command.apply(document);
    const undone = inverse.apply(applied);

    expect(undone).toEqual(document);
    expect(undone.physicalScale).toBeUndefined();
  });

  it('test_applyThenRedo_matchesOriginalApply', () => {
    const document = baseDocument();
    const command = new SetPhysicalScaleCommand({ valuePerCell: 30, unit: 'cm' });

    const inverse = command.invert(document);
    const applied = command.apply(document);
    const undone = inverse.apply(applied);
    const redone = command.apply(undone);

    expect(redone).toEqual(applied);
  });
});
