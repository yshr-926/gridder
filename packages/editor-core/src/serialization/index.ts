/**
 * Document persistence for editor-core (issue #54, spec §9). Kept separate
 * from `validation.ts` — that module checks invariants on a document already
 * in memory; this one turns a document into saved bytes and back, including
 * the failure modes specific to reading an arbitrary `.json` file back in.
 *
 * The root package barrel re-exports this module; it is kept separate so that
 * parallel work on other editor-core modules does not collide on one file.
 */
export { DocumentDeserializationError, type DocumentDeserializationErrorCode } from './errors.js';
export { serializeDocument, deserializeDocument } from './document-serialization.js';
