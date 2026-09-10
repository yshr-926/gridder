import {
  CombineShapesCommand,
  createPolygonClippingEngine,
  frontmostShapeId,
  SubtractShapesCommand,
  unionOfShapes,
  type EditorDocument,
  type PolygonBooleanEngine,
} from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { useToastStore } from '@/hooks/useToast';
import { editorSession } from './useEditorSession';

/**
 * Combine / subtract the current selection (issue #62, spec §7, ADR-0006).
 * Each is exactly one editor-core Command, so each is a single Undo step
 * that brings every original shape back. The polygon boolean Adapter is
 * stateless, so one module-level instance serves every call.
 */
const booleanEngine: PolygonBooleanEngine = createPolygonClippingEngine();

/** Fewer than two shapes have nothing to combine or subtract. */
const MIN_OPERAND_COUNT = 2;

/**
 * Selected shape ids resolved against the live document. Taken verbatim: group
 * membership was already applied when the selection was made (issue #52, see
 * `groupSelection.ts`).
 */
const selectedOperandIds = (document: EditorDocument): readonly string[] =>
  useSelectionStore.getState().selectedIds.filter((id) => document.shapes[id] !== undefined);

/**
 * Union the selection into one shape and select it. Refused with a toast —
 * and no Command — when the shapes neither overlap nor share an edge: the
 * union would be more than one polygon, and `CombineShapesCommand` only
 * produces exactly one shape (see its doc comment for why disconnected
 * results are rejected rather than kept as several shapes).
 */
export const combineSelection = (): void => {
  const document = editorSession.getDocument();
  const shapeIds = selectedOperandIds(document);
  if (shapeIds.length < MIN_OPERAND_COUNT) {
    return;
  }
  if (unionOfShapes(document, shapeIds, booleanEngine).length !== 1) {
    useToastStore.getState().addToast({
      type: 'error',
      message: '離れた図形は結合できません。重なるか辺で接する図形を選択してください。',
    });
    return;
  }
  const keeperId = frontmostShapeId(document, shapeIds);
  editorSession.dispatch(new CombineShapesCommand(shapeIds, booleanEngine));
  useSelectionStore.getState().selectOnly(keeperId);
};

/**
 * Subtract the frontmost selected shape from every other selected shape,
 * then select whatever remains of the subjects — including any pieces a
 * split produced. The cutter is consumed by the operation, so it is never
 * part of the resulting selection; when nothing survives (every subject was
 * fully covered) the selection is cleared.
 */
export const subtractSelection = (): void => {
  const before = editorSession.getDocument();
  const shapeIds = selectedOperandIds(before);
  if (shapeIds.length < MIN_OPERAND_COUNT) {
    return;
  }
  const cutterId = frontmostShapeId(before, shapeIds);
  const subjectIds = new Set(shapeIds.filter((id) => id !== cutterId));

  const after = editorSession.dispatch(new SubtractShapesCommand(shapeIds, booleanEngine));

  // Survivors keep their ids; split-off pieces are the ids that did not
  // exist before. Walk the new z-order so the selection order is stable.
  const resultIds = after.zOrder.filter(
    (id) => subjectIds.has(id) || before.shapes[id] === undefined
  );
  const selection = useSelectionStore.getState();
  if (resultIds.length === 0) {
    selection.clear();
  } else {
    selection.setSelection(resultIds);
  }
};
