import type { Page } from '@playwright/test';

/**
 * Reads into the polygon-document runtime exposed only for the E2E build
 * (`VITE_E2E=true`, see `useEditorSession.ts` / `selectionStore.ts`). Every
 * shape here is a minimal readonly snapshot (issue #58) — no full
 * `EditorDocument` type is imported from `@gridder/editor-core` because e2e
 * runs against the built app, not its source.
 */

export interface E2eShapeStyle {
  readonly fill: string;
  readonly opacity: number;
  readonly isBorderVisible: boolean;
}

export interface E2eShape {
  readonly id: string;
  readonly name?: string;
  readonly polygon: {
    readonly outerRing: readonly { x: number; y: number }[];
    readonly innerRings: readonly (readonly { x: number; y: number }[])[];
  };
  readonly style: E2eShapeStyle;
}

export interface E2eDocumentSnapshot {
  readonly shapeCount: number;
  /** Shapes in z-order (back to front). */
  readonly shapes: readonly E2eShape[];
  /** Shape ids in the same z-order as {@link shapes}. */
  readonly zOrder: readonly string[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly groupCount: number;
}

/** The full document snapshot (shape count, shapes in z-order, undo/redo flags, group count). */
export const readDocument = (page: Page): Promise<E2eDocumentSnapshot> =>
  page.evaluate(() => {
    const session = (
      window as unknown as {
        __GRIDDER_EDITOR_SESSION__: {
          shapeCount: number;
          canUndo: boolean;
          canRedo: boolean;
          getDocument: () => {
            shapes: Record<string, E2eShape>;
            zOrder: readonly string[];
            groups: Record<string, unknown>;
          };
        };
      }
    ).__GRIDDER_EDITOR_SESSION__;
    const document = session.getDocument();
    return {
      shapeCount: session.shapeCount,
      shapes: document.zOrder.map((id) => document.shapes[id]),
      zOrder: document.zOrder,
      canUndo: session.canUndo,
      canRedo: session.canRedo,
      groupCount: Object.keys(document.groups).length,
    };
  });

/** Convenience: just the shape count. */
export const readShapeCount = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __GRIDDER_EDITOR_SESSION__: { shapeCount: number } }
      ).__GRIDDER_EDITOR_SESSION__.shapeCount
  );

export interface E2eSelectionSnapshot {
  readonly selectedIds: readonly string[];
  readonly primaryId: string | null;
  readonly activeGroupId: string | null;
}

/** The current selection (selected shape ids, primary id, active group). */
export const readSelection = (page: Page): Promise<E2eSelectionSnapshot> =>
  page.evaluate(() => {
    const store = (
      window as unknown as {
        __GRIDDER_SELECTION_STORE__: { getState: () => E2eSelectionSnapshot };
      }
    ).__GRIDDER_SELECTION_STORE__;
    const state = store.getState();
    return {
      selectedIds: state.selectedIds,
      primaryId: state.primaryId,
      activeGroupId: state.activeGroupId,
    };
  });

/** Find a shape by id in a document snapshot; throws if absent. */
export const requireShape = (document: E2eDocumentSnapshot, shapeId: string): E2eShape => {
  const shape = document.shapes.find((candidate) => candidate.id === shapeId);
  if (shape === undefined) {
    throw new Error(`shape "${shapeId}" not found in document snapshot`);
  }
  return shape;
};
