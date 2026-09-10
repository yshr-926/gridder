import type { DocumentValidationIssue } from '../validation.js';

/**
 * Reasons {@link deserializeDocument} can fail (issue #54, spec §9). Distinct
 * from {@link DocumentValidationIssue}'s codes: those describe *which*
 * document invariant broke, this describes *why deserialization itself*
 * could not produce a document to validate in the first place.
 */
export type DocumentDeserializationErrorCode =
  /** The input was not valid JSON at all (`JSON.parse` threw). */
  | 'invalid-json'
  /** Valid JSON, but not shaped like a serialized document (wrong types, missing fields). */
  | 'malformed-document'
  /** Shaped correctly, but `formatVersion` is not one this release understands. */
  | 'unsupported-format-version'
  /** Shaped correctly and a known version, but fails a cross-document invariant. */
  | 'invalid-document';

/**
 * Thrown by {@link deserializeDocument}. Callers (the file Adapters in
 * `apps/web/src/features/file`) switch on {@link code} to show a specific
 * message; {@link issues} is populated only for `'invalid-document'`.
 */
export class DocumentDeserializationError extends Error {
  readonly code: DocumentDeserializationErrorCode;
  readonly issues: readonly DocumentValidationIssue[];

  constructor(
    code: DocumentDeserializationErrorCode,
    message: string,
    issues: readonly DocumentValidationIssue[] = []
  ) {
    super(message);
    this.name = 'DocumentDeserializationError';
    this.code = code;
    this.issues = issues;
  }
}
