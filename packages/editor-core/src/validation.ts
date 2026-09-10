import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  MAX_ANNOTATION_FONT_SIZE,
  MIN_ANNOTATION_FONT_SIZE,
  SHAPE_FILL_PALETTE,
  isValidAnnotationFontSize,
  type EditorDocument,
  type GridPoint,
  type GridRing,
  type ShapeFillColor,
} from './model.js';

export type DocumentValidationIssueCode =
  | 'unsupported-format-version'
  | 'invalid-shape-id'
  | 'shape-id-mismatch'
  | 'invalid-ring'
  | 'non-integer-coordinate'
  | 'consecutive-duplicate-vertex'
  | 'invalid-fill-color'
  | 'invalid-opacity'
  | 'duplicate-z-order-entry'
  | 'unknown-z-order-shape'
  | 'missing-z-order-shape'
  | 'invalid-group-id'
  | 'group-id-mismatch'
  | 'group-too-small'
  | 'duplicate-group-member'
  | 'nested-group'
  | 'unknown-group-shape'
  | 'shape-in-multiple-groups'
  | 'invalid-drawing-bounds'
  | 'invalid-physical-scale'
  | 'invalid-annotation-font-size';

export interface DocumentValidationIssue {
  readonly code: DocumentValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

const isSamePoint = (first: GridPoint, second: GridPoint): boolean =>
  first.x === second.x && first.y === second.y;

const isShapeFillColor = (value: string): value is ShapeFillColor =>
  (SHAPE_FILL_PALETTE as readonly string[]).includes(value);

const validateRing = (ring: GridRing, path: string, issues: DocumentValidationIssue[]): void => {
  const distinctPoints = new Set(ring.map(({ x, y }) => `${x},${y}`));

  if (distinctPoints.size < 3) {
    issues.push({
      code: 'invalid-ring',
      path,
      message: 'A ring must contain at least three distinct vertices.',
    });
  }

  ring.forEach((point, index) => {
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) {
      issues.push({
        code: 'non-integer-coordinate',
        path: `${path}[${index}]`,
        message: 'Grid vertex coordinates must be integers.',
      });
    }

    const nextPoint = ring[(index + 1) % ring.length];
    if (nextPoint !== undefined && isSamePoint(point, nextPoint)) {
      issues.push({
        code: 'consecutive-duplicate-vertex',
        path: `${path}[${index}]`,
        message: 'Adjacent vertices, including the implicit closing edge, must differ.',
      });
    }
  });
};

/**
 * Checks cross-document invariants without depending on React, a renderer,
 * browser APIs, persistence, or a polygon operation library.
 */
export const validateDocument = (document: EditorDocument): readonly DocumentValidationIssue[] => {
  const issues: DocumentValidationIssue[] = [];

  if (document.formatVersion !== CURRENT_DOCUMENT_FORMAT_VERSION) {
    issues.push({
      code: 'unsupported-format-version',
      path: 'formatVersion',
      message: `Only document format version ${CURRENT_DOCUMENT_FORMAT_VERSION} is supported.`,
    });
  }

  const shapeEntries = Object.entries(document.shapes);
  const shapeIds = new Set(shapeEntries.map(([shapeId]) => shapeId));

  shapeEntries.forEach(([shapeId, shape]) => {
    const shapePath = `shapes.${shapeId}`;

    if (shapeId.length === 0 || shape.id.length === 0) {
      issues.push({
        code: 'invalid-shape-id',
        path: `${shapePath}.id`,
        message: 'Shape IDs must not be empty.',
      });
    }

    if (shape.id !== shapeId) {
      issues.push({
        code: 'shape-id-mismatch',
        path: `${shapePath}.id`,
        message: 'A shape ID must match its document record key.',
      });
    }

    validateRing(shape.polygon.outerRing, `${shapePath}.polygon.outerRing`, issues);
    shape.polygon.innerRings.forEach((ring, index) => {
      validateRing(ring, `${shapePath}.polygon.innerRings[${index}]`, issues);
    });

    if (!isShapeFillColor(shape.style.fill)) {
      issues.push({
        code: 'invalid-fill-color',
        path: `${shapePath}.style.fill`,
        message: 'Shape fill must come from the curated palette.',
      });
    }

    if (
      !Number.isFinite(shape.style.opacity) ||
      shape.style.opacity < 0 ||
      shape.style.opacity > 1
    ) {
      issues.push({
        code: 'invalid-opacity',
        path: `${shapePath}.style.opacity`,
        message: 'Shape opacity must be a finite number from 0 through 1.',
      });
    }
  });

  const orderedShapeIds = new Set<string>();
  document.zOrder.forEach((shapeId, index) => {
    if (orderedShapeIds.has(shapeId)) {
      issues.push({
        code: 'duplicate-z-order-entry',
        path: `zOrder[${index}]`,
        message: 'Each shape must appear exactly once in z-order.',
      });
    }
    orderedShapeIds.add(shapeId);

    if (!shapeIds.has(shapeId)) {
      issues.push({
        code: 'unknown-z-order-shape',
        path: `zOrder[${index}]`,
        message: 'Z-order must reference an existing shape.',
      });
    }
  });

  shapeIds.forEach((shapeId) => {
    if (!orderedShapeIds.has(shapeId)) {
      issues.push({
        code: 'missing-z-order-shape',
        path: 'zOrder',
        message: `Shape "${shapeId}" is missing from z-order.`,
      });
    }
  });

  const groupEntries = Object.entries(document.groups);
  const groupIds = new Set(groupEntries.map(([groupId]) => groupId));
  const groupedShapeOwners = new Map<string, string>();

  groupEntries.forEach(([groupId, group]) => {
    const groupPath = `groups.${groupId}`;

    if (groupId.length === 0 || group.id.length === 0) {
      issues.push({
        code: 'invalid-group-id',
        path: `${groupPath}.id`,
        message: 'Group IDs must not be empty.',
      });
    }

    if (group.id !== groupId) {
      issues.push({
        code: 'group-id-mismatch',
        path: `${groupPath}.id`,
        message: 'A group ID must match its document record key.',
      });
    }

    if (group.shapeIds.length < 2) {
      issues.push({
        code: 'group-too-small',
        path: `${groupPath}.shapeIds`,
        message: 'A group must contain at least two shapes.',
      });
    }

    const currentGroupShapeIds = new Set<string>();
    group.shapeIds.forEach((shapeId, index) => {
      const memberPath = `${groupPath}.shapeIds[${index}]`;

      if (currentGroupShapeIds.has(shapeId)) {
        issues.push({
          code: 'duplicate-group-member',
          path: memberPath,
          message: 'A shape may appear only once in a group.',
        });
      }
      currentGroupShapeIds.add(shapeId);

      if (groupIds.has(shapeId)) {
        issues.push({
          code: 'nested-group',
          path: memberPath,
          message: 'Groups may contain shape IDs only and cannot be nested.',
        });
      } else if (!shapeIds.has(shapeId)) {
        issues.push({
          code: 'unknown-group-shape',
          path: memberPath,
          message: 'A group must reference an existing shape.',
        });
      }

      const ownerGroupId = groupedShapeOwners.get(shapeId);
      if (ownerGroupId !== undefined && ownerGroupId !== groupId) {
        issues.push({
          code: 'shape-in-multiple-groups',
          path: memberPath,
          message: 'A shape may belong to at most one group.',
        });
      }
      if (shapeIds.has(shapeId)) {
        groupedShapeOwners.set(shapeId, groupId);
      }
    });
  });

  const { min, max } = document.drawingBounds;
  if (
    !Number.isInteger(min.x) ||
    !Number.isInteger(min.y) ||
    !Number.isInteger(max.x) ||
    !Number.isInteger(max.y) ||
    min.x >= max.x ||
    min.y >= max.y
  ) {
    issues.push({
      code: 'invalid-drawing-bounds',
      path: 'drawingBounds',
      message: 'Drawing bounds must have integer coordinates and positive width and height.',
    });
  }

  if (
    document.physicalScale !== undefined &&
    (!Number.isFinite(document.physicalScale.valuePerCell) ||
      document.physicalScale.valuePerCell <= 0)
  ) {
    issues.push({
      code: 'invalid-physical-scale',
      path: 'physicalScale.valuePerCell',
      message: 'Physical scale must be a finite number greater than zero.',
    });
  }

  if (!isValidAnnotationFontSize(document.annotationFontSize)) {
    issues.push({
      code: 'invalid-annotation-font-size',
      path: 'annotationFontSize',
      message: `Annotation font size must be an integer from ${MIN_ANNOTATION_FONT_SIZE} through ${MAX_ANNOTATION_FONT_SIZE}.`,
    });
  }

  return issues;
};

export const isDocumentValid = (document: EditorDocument): boolean =>
  validateDocument(document).length === 0;
