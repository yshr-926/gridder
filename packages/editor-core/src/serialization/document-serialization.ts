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

/** The numeric `formatVersion` of any parsed object, or `undefined` when there is none. */
const readFormatVersion = (parsed: unknown): number | undefined => {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  const { formatVersion } = parsed as { formatVersion?: unknown };
  return typeof formatVersion === 'number' ? formatVersion : undefined;
};

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
 * - `'unsupported-format-version'` — an object whose numeric `formatVersion`
 *   isn't {@link CURRENT_DOCUMENT_FORMAT_VERSION}. Checked before the shape,
 *   so a file from an older Gridder is reported as old rather than malformed.
 *   Gridder does not migrate older formats (spec §9: "過去のGridder JSONとの
 *   互換性は提供しない").
 * - `'malformed-document'` — valid JSON, but not shaped like a document (a
 *   missing field, a `shapes` that isn't a record, etc.).
 * - `'invalid-document'` — a known version and correct shape, but it fails a
 *   {@link validateDocument} invariant (e.g. a non-integer vertex). The
 *   issues are attached to the error for the caller to display or log.
 */
export const deserializeDocument = (text: string): EditorDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DocumentDeserializationError('invalid-json', 'The file is not valid JSON.');
  }

  // Version before shape: an older Gridder file (e.g. format 1, which had no
  // `annotationFontSize`) is not shaped like the current document, and the
  // user deserves "this file is too old" rather than "this is not a sketch".
  const formatVersion = readFormatVersion(parsed);
  if (formatVersion !== undefined && formatVersion !== CURRENT_DOCUMENT_FORMAT_VERSION) {
    throw new DocumentDeserializationError(
      'unsupported-format-version',
      `This file uses format version ${formatVersion}, but only version ${CURRENT_DOCUMENT_FORMAT_VERSION} is supported.`
    );
  }

  if (!isEditorDocumentShaped(parsed)) {
    throw new DocumentDeserializationError(
      'malformed-document',
      'The file is not shaped like a Gridder sketch.'
    );
  }

  const issues = validateDocument(parsed);
  if (issues.length > 0) {
    throw new DocumentDeserializationError(
      'invalid-document',
      'The file is not a valid Gridder sketch.',
      issues
    );
  }

  return parsed;
};
