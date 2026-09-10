import { describe, expect, it } from 'vitest';

import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
  type EditorShape,
  type GridPolygon,
} from '../model.js';
import { isDocumentValid } from '../validation.js';
import {
  CompositeCommand,
  CreateShapeCommand,
  DeleteShapeCommand,
  type EditorCommand,
  GroupShapesCommand,
  RenameShapeCommand,
  ReorderShapeCommand,
  ReplaceShapeVerticesCommand,
  SetDrawingBoundsCommand,
  SetShapeStyleCommand,
  UngroupShapesCommand,
} from './index.js';

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
  },
  zOrder: ['shape-a', 'shape-b'],
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 12, y: 6 } },
});

/**
 * Applies a Command, then undo, then redo, asserting the document is
 * structurally identical before and after undo, and after redo it matches the
 * applied state (受け入れ条件: apply → undo → redo で完全一致).
 */
const expectRoundTrip = (
  document: EditorDocument,
  command: EditorCommand
): { applied: EditorDocument } => {
  const inverse = command.invert(document);
  const applied = command.apply(document);
  const undone = inverse.apply(applied);
  expect(undone).toEqual(document);
  const redone = command.apply(undone);
  expect(redone).toEqual(applied);
  return { applied };
};

describe('CreateShapeCommand', () => {
  it('test_CreateShapeCommand_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const { applied } = expectRoundTrip(doc, new CreateShapeCommand(rectangle('shape-c', 12)));
    expect(applied.zOrder).toEqual(['shape-a', 'shape-b', 'shape-c']);
    expect(isDocumentValid(applied)).toBe(true);
  });

  it('test_CreateShapeCommand_zIndex_insertsAtRequestedSlot', () => {
    const doc = baseDocument();
    const applied = new CreateShapeCommand(rectangle('shape-c', 12), 0).apply(doc);
    expect(applied.zOrder).toEqual(['shape-c', 'shape-a', 'shape-b']);
  });

  it('test_CreateShapeCommand_apply_doesNotMutateInput', () => {
    const doc = baseDocument();
    const snapshot = structuredClone(doc);
    new CreateShapeCommand(rectangle('shape-c', 12)).apply(doc);
    expect(doc).toEqual(snapshot);
  });
});

describe('DeleteShapeCommand', () => {
  it('test_DeleteShapeCommand_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const { applied } = expectRoundTrip(doc, new DeleteShapeCommand('shape-a'));
    expect(applied.shapes['shape-a']).toBeUndefined();
    expect(applied.zOrder).toEqual(['shape-b']);
  });

  it('test_DeleteShapeCommand_undo_restoresZOrderPosition', () => {
    const doc = baseDocument();
    const command = new DeleteShapeCommand('shape-a');
    const inverse = command.invert(doc);
    expect(inverse.apply(command.apply(doc)).zOrder).toEqual(['shape-a', 'shape-b']);
  });
});

describe('ReplaceShapeVerticesCommand', () => {
  it('test_ReplaceShapeVerticesCommand_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const moved: GridPolygon = {
      outerRing: [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 4 },
        { x: 1, y: 4 },
      ],
      innerRings: [],
    };
    const { applied } = expectRoundTrip(doc, new ReplaceShapeVerticesCommand('shape-a', moved));
    expect(applied.shapes['shape-a']?.polygon).toEqual(moved);
  });

  it('test_ReplaceShapeVerticesCommand_acceptsExternallyComputedPolygon', () => {
    // The boolean-op result (issue #37) arrives as a finished polygon; the
    // Command never runs the operation itself.
    const doc = baseDocument();
    const withHole: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [
        [
          { x: 2, y: 2 },
          { x: 2, y: 4 },
          { x: 4, y: 4 },
          { x: 4, y: 2 },
        ],
      ],
    };
    const applied = new ReplaceShapeVerticesCommand('shape-a', withHole).apply(doc);
    expect(applied.shapes['shape-a']?.polygon.innerRings).toHaveLength(1);
  });
});

describe('SetShapeStyleCommand', () => {
  it('test_SetShapeStyleCommand_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const { applied } = expectRoundTrip(
      doc,
      new SetShapeStyleCommand('shape-a', {
        fill: '#ef4444',
        opacity: 0.5,
        isBorderVisible: false,
      })
    );
    expect(applied.shapes['shape-a']?.style.fill).toBe('#ef4444');
  });
});

describe('RenameShapeCommand', () => {
  it('test_RenameShapeCommand_setName_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    expectRoundTrip(doc, new RenameShapeCommand('shape-a', 'Table'));
  });

  it('test_RenameShapeCommand_clearName_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const { applied } = expectRoundTrip(doc, new RenameShapeCommand('shape-a', undefined));
    expect('name' in (applied.shapes['shape-a'] ?? {})).toBe(false);
  });
});

describe('ReorderShapeCommand', () => {
  it('test_ReorderShapeCommand_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const { applied } = expectRoundTrip(doc, new ReorderShapeCommand('shape-a', 1));
    expect(applied.zOrder).toEqual(['shape-b', 'shape-a']);
  });
});

describe('SetDrawingBoundsCommand', () => {
  it('test_SetDrawingBoundsCommand_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const { applied } = expectRoundTrip(
      doc,
      new SetDrawingBoundsCommand({
        mode: 'manual',
        min: { x: -2, y: -2 },
        max: { x: 20, y: 20 },
      })
    );
    expect(applied.drawingBounds.mode).toBe('manual');
  });
});

describe('GroupShapesCommand / UngroupShapesCommand', () => {
  it('test_GroupShapesCommand_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const { applied } = expectRoundTrip(
      doc,
      new GroupShapesCommand('group-1', ['shape-a', 'shape-b'])
    );
    expect(applied.groups['group-1']?.shapeIds).toEqual(['shape-a', 'shape-b']);
    expect(isDocumentValid(applied)).toBe(true);
  });

  it('test_UngroupShapesCommand_applyUndoRedo_documentMatches', () => {
    const grouped = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    expectRoundTrip(grouped, new UngroupShapesCommand('group-1'));
  });

  it('test_GroupShapesCommand_shapeAlreadyGrouped_dissolvesExistingGroup', () => {
    // Nested groups are impossible by construction (spec §7): re-grouping a
    // shape that already belongs to one dissolves that group rather than
    // throwing (issue #52's chosen rule — see the class doc comment).
    const grouped = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    const regrouped = new GroupShapesCommand('group-2', ['shape-a', 'shape-b']).apply(grouped);
    expect(regrouped.groups['group-1']).toBeUndefined();
    expect(regrouped.groups['group-2']?.shapeIds).toEqual(['shape-a', 'shape-b']);
    expect(isDocumentValid(regrouped)).toBe(true);
  });

  it('test_GroupShapesCommand_shapeAlreadyGrouped_invert_restoresDissolvedGroup', () => {
    const grouped = new GroupShapesCommand('group-1', ['shape-a', 'shape-b']).apply(baseDocument());
    const command = new GroupShapesCommand('group-2', ['shape-a', 'shape-b']);
    const { applied } = expectRoundTrip(grouped, command);
    expect(applied.groups['group-2']?.shapeIds).toEqual(['shape-a', 'shape-b']);
  });

  it('test_GroupShapesCommand_fewerThanTwoShapes_throws', () => {
    expect(() => new GroupShapesCommand('group-1', ['shape-a']).apply(baseDocument())).toThrow();
  });
});

describe('CompositeCommand', () => {
  it('test_CompositeCommand_applyUndoRedo_documentMatches', () => {
    const doc = baseDocument();
    const split = new CompositeCommand(
      [
        new DeleteShapeCommand('shape-a'),
        new CreateShapeCommand(rectangle('shape-a1', 0)),
        new CreateShapeCommand(rectangle('shape-a2', 20)),
      ],
      'Split shape'
    );
    const { applied } = expectRoundTrip(doc, split);
    expect(Object.keys(applied.shapes).sort()).toEqual(['shape-a1', 'shape-a2', 'shape-b']);
    expect(isDocumentValid(applied)).toBe(true);
  });

  it('test_CompositeCommand_empty_throws', () => {
    expect(() => new CompositeCommand([])).toThrow();
  });
});
