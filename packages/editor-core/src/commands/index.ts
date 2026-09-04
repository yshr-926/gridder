/**
 * Document Commands for editor-core (spec §11). Not to be confused with
 * `apps/web/src/features/commands`, the textual command-palette parser, which
 * has no connection to the document history.
 *
 * The root package barrel re-exports this module; it is kept separate so that
 * parallel work on other editor-core modules does not collide on one file.
 */
export { CommandApplicationError, type EditorCommand } from './command.js';
export { CompositeCommand } from './composite-command.js';
export {
  CreateShapeCommand,
  DeleteShapeCommand,
  RenameShapeCommand,
  ReplaceShapeVerticesCommand,
  SetShapeStyleCommand,
} from './shape-commands.js';
export {
  GroupShapesCommand,
  ReorderShapeCommand,
  SetDrawingBoundsCommand,
  UngroupShapesCommand,
} from './structure-commands.js';
