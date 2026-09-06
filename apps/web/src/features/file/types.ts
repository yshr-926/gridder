/**
 * Browser file Adapter contract for sketch persistence (issue #54, ADR-0004).
 *
 * Two implementations sit behind this interface — {@link FileSystemAccessAdapter}
 * (Chromium's `showSaveFilePicker` / `showOpenFilePicker`, holding a handle so
 * repeat saves overwrite the same file) and {@link DownloadFallbackAdapter}
 * (download + `<input type=file>` for browsers without that API) — chosen by
 * feature detection in `selectFileAdapter`. Nothing above this interface
 * (`fileSession.ts`, the Header menu) ever branches on which one is active.
 */

/** Default filename (without extension) offered to `save` / `saveAs`. */
export const DEFAULT_SKETCH_FILENAME = 'sketch';

export interface SaveResult {
  /** Filename the content was actually saved as, for the "saved as ___" Toast. */
  readonly fileName: string;
}

export interface OpenResult {
  readonly fileName: string;
  readonly content: string;
}

export interface FileAdapter {
  /**
   * Save `content`. When a file is already associated with this session (the
   * File System Access adapter after a prior `save` or `open`; never for the
   * download fallback, which has no such concept), overwrites it silently.
   * Otherwise behaves like {@link saveAs}. Resolves to `null` if the user
   * cancels a picker.
   */
  save(content: string, suggestedName?: string): Promise<SaveResult | null>;

  /** Always prompt for a destination, even if a file is already associated. */
  saveAs(content: string, suggestedName?: string): Promise<SaveResult | null>;

  /**
   * Prompt the user to choose a `.json` file and read it. Associates that
   * file with this session for subsequent {@link save} calls where the
   * underlying platform supports it. Resolves to `null` if the user cancels.
   */
  open(): Promise<OpenResult | null>;

  /** Whether {@link save} currently has a file to overwrite without prompting. */
  readonly hasAssociatedFile: boolean;
}
