// Drawing feature
export {
  useDrawing,
  groupConnectedCells,
  normalizeCells,
} from './drawing';

// Eraser feature
export {
  useEraser,
  groupConnectedCells4Direction,
  findCellInObjects,
} from './eraser';

// Selection feature
export { useSelection, findObjectAtCell } from './selection';

// Collaboration feature (types and errors)
export type {
  CursorPosition,
  CollaboratorInfo,
  Presence,
  RoomInfo,
  ConnectionState,
  CollaborationState,
  CollaborationActions,
  CursorColor,
} from './collaboration';

export {
  CURSOR_COLORS,
  DISPLAY_NAME_CONSTRAINTS,
  ROOM_ID_CONSTRAINTS,
  PRESENCE_THROTTLE_MS,
  ROOM_EXPIRY_MS,
  CollaborationErrorCode,
  COLLABORATION_ERROR_MESSAGES,
  CollaborationError,
  isCollaborationError,
  getErrorMessage,
} from './collaboration';
