import { CURRENT_DOCUMENT_FORMAT_VERSION, type EditorDocument } from '../model.js';
import { validateDocument } from '../validation.js';
import { DocumentDeserializationError } from './errors.js';
import { isEditorDocumentShaped } from './structural-guard.js';

/**
 * Document persistence (issue #54, spec §9 / §11): a saved `.json` file holds
 * exactly the {@link EditorDocument} — Undo/Redo history is transient app
 * state and never written out, matching spec §11 "Undo履歴はJSONへ保存しない".
 *
 * `EditorDocument` is already a plain, `readonly`-only structure of objects,
 * arrays, strings, numbers and booleans, so serializing it is just handing it
 * to `JSON.stringify`; the interesting work — and the reason this isn't a
 * one-liner at the call site — lives in {@link deserializeDocument}, which
 * must not trust a `.json` file a user (or a future format version) might
 * hand it.
 */

/** Turn a document into its saved JSON text. Pretty-printed for human-readable diffs. */
export const serializeDocument = (document: EditorDocument): string =>
  JSON.stringify(document, null, 2);

/**
 * Parse and validate a saved document. Throws {@link DocumentDeserializationError}
 * for every failure mode instead of returning `null` / `undefined`, so a
 * caller that forgets to check a return value fails loudly rather than
 * crashing later on a malformed document:
 *
 * - `'invalid-json'` — `text` is not valid JSON at all.
 * - `'malformed-document'` — valid JSON, but not shaped like a document (a
 *   missing field, a `shapes` that isn't a record, etc.).
 * - `'unsupported-format-version'` — shaped correctly, but `formatVersion`
 *   isn't {@link CURRENT_DOCUMENT_FORMAT_VERSION}. Gridder does not migrate
 *   older formats (spec §9: "過去のGridder JSONとの互換性は提供しない").
 * - `'invalid-document'` — a known version and correct shape, but it fails a
 *   {@link validateDocument} invariant (e.g. a non-integer vertex). The
 *   issues are attached to the error for the caller to display or log.
 */
export const deserializeDocument = (text: string): EditorDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DocumentDeserializationError(
      'invalid-json',
      'The file is not valid JSON.',
    );
  }

  if (!isEditorDocumentShaped(parsed)) {
    throw new DocumentDeserializationError(
      'malformed-document',
      'The file is not shaped like a Gridder sketch.',
    );
  }

  if (parsed.formatVersion !== CURRENT_DOCUMENT_FORMAT_VERSION) {
    throw new DocumentDeserializationError(
      'unsupported-format-version',
      `This file uses format version ${parsed.formatVersion}, but only version ${CURRENT_DOCUMENT_FORMAT_VERSION} is supported.`,
    );
  }

  const issues = validateDocument(parsed);
  if (issues.length > 0) {
    throw new DocumentDeserializationError(
      'invalid-document',
      'The file is not a valid Gridder sketch.',
      issues,
    );
  }

  return parsed;
};
