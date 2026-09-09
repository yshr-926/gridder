import type {
  DrawingBounds,
  EditorDocument,
  EditorShape,
  GridPolygon,
  PhysicalScale,
  ShapeGroup,
  ShapeId,
  ShapeStyle,
} from '../model.js';

/**
 * Small immutable helpers shared by the Command implementations. Each returns a
 * new {@link EditorDocument}; none mutate their arguments. They enforce only the
 * structural invariants a single Command is responsible for — cross-document
 * validation stays in `validateDocument`.
 */

const withoutKey = <T>(
  record: Readonly<Record<string, T>>,
  key: string,
): Record<string, T> => {
  const next: Record<string, T> = { ...record };
  delete next[key];
  return next;
};

export const insertShape = (
  document: EditorDocument,
  shape: EditorShape,
  zIndex: number,
): EditorDocument => {
  if (document.shapes[shape.id] !== undefined) {
    throw new Error(`Shape "${shape.id}" already exists.`);
  }
  const clampedIndex = Math.max(0, Math.min(zIndex, document.zOrder.length));
  const zOrder = [
    ...document.zOrder.slice(0, clampedIndex),
    shape.id,
    ...document.zOrder.slice(clampedIndex),
  ];
  return {
    ...document,
    shapes: { ...document.shapes, [shape.id]: shape },
    zOrder,
  };
};

export const removeShape = (
  document: EditorDocument,
  shapeId: ShapeId,
): EditorDocument => {
  if (document.shapes[shapeId] === undefined) {
    throw new Error(`Shape "${shapeId}" does not exist.`);
  }
  const groups: Record<string, ShapeGroup> = {};
  for (const [groupId, group] of Object.entries(document.groups)) {
    const shapeIds = group.shapeIds.filter((id) => id !== shapeId);
    // A group must keep at least two members; drop it once it cannot.
    if (shapeIds.length >= 2) {
      groups[groupId] = { ...group, shapeIds };
    }
  }
  return {
    ...document,
    shapes: withoutKey(document.shapes, shapeId),
    zOrder: document.zOrder.filter((id) => id !== shapeId),
    groups,
  };
};

export const replaceShape = (
  document: EditorDocument,
  shape: EditorShape,
): EditorDocument => {
  if (document.shapes[shape.id] === undefined) {
    throw new Error(`Shape "${shape.id}" does not exist.`);
  }
  return {
    ...document,
    shapes: { ...document.shapes, [shape.id]: shape },
  };
};

export const requireShape = (
  document: EditorDocument,
  shapeId: ShapeId,
): EditorShape => {
  const shape = document.shapes[shapeId];
  if (shape === undefined) {
    throw new Error(`Shape "${shapeId}" does not exist.`);
  }
  return shape;
};

export const withShapePolygon = (
  shape: EditorShape,
  polygon: GridPolygon,
): EditorShape => ({ ...shape, polygon });

export const withShapeStyle = (
  shape: EditorShape,
  style: ShapeStyle,
): EditorShape => ({ ...shape, style });

export const withShapeName = (
  shape: EditorShape,
  name: string | undefined,
): EditorShape => {
  if (name === undefined) {
    const next: EditorShape = { ...shape };
    delete (next as { name?: string }).name;
    return next;
  }
  return { ...shape, name };
};

export const withZOrder = (
  document: EditorDocument,
  zOrder: readonly ShapeId[],
): EditorDocument => ({ ...document, zOrder });

export const withDrawingBounds = (
  document: EditorDocument,
  drawingBounds: DrawingBounds,
): EditorDocument => ({ ...document, drawingBounds });

/** `undefined` clears the real-world scale, returning the sketch to plain cell counts. */
export const withPhysicalScale = (
  document: EditorDocument,
  physicalScale: PhysicalScale | undefined,
): EditorDocument => {
  if (physicalScale === undefined) {
    const next: EditorDocument = { ...document };
    delete (next as { physicalScale?: PhysicalScale }).physicalScale;
    return next;
  }
  return { ...document, physicalScale };
};

export const withAnnotationFontSize = (
  document: EditorDocument,
  annotationFontSize: number,
): EditorDocument => ({ ...document, annotationFontSize });

export const putGroup = (
  document: EditorDocument,
  group: ShapeGroup,
): EditorDocument => ({
  ...document,
  groups: { ...document.groups, [group.id]: group },
});

export const dropGroup = (
  document: EditorDocument,
  groupId: string,
): EditorDocument => ({
  ...document,
  groups: withoutKey(document.groups, groupId),
});

export const requireGroup = (
  document: EditorDocument,
  groupId: string,
): ShapeGroup => {
  const group = document.groups[groupId];
  if (group === undefined) {
    throw new Error(`Group "${groupId}" does not exist.`);
  }
  return group;
};

export const indexInZOrder = (
  document: EditorDocument,
  shapeId: ShapeId,
): number => {
  const index = document.zOrder.indexOf(shapeId);
  if (index === -1) {
    throw new Error(`Shape "${shapeId}" is missing from z-order.`);
  }
  return index;
};
