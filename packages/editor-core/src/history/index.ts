/**
 * Undo / Redo history for editor-core (spec §11). React-free: `subscribe` is a
 * bare callback registry the app layer adapts to its state library.
 *
 * The root package barrel re-exports this module; it is kept separate so
 * parallel work on other editor-core modules does not collide on one file.
 */
export {
  DocumentHistory,
  type DocumentHistoryListener,
  type DocumentHistoryOptions,
  type Unsubscribe,
} from './document-history.js';
