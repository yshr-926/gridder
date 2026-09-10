import type { FileAdapter, OpenResult, SaveResult } from './types';

/** `.json` file type filter offered to both pickers. */
const JSON_FILE_TYPES: FilePickerAcceptType[] = [
  { description: 'Gridder sketch', accept: { 'application/json': ['.json'] } },
];

const withJsonExtension = (name: string): string =>
  name.toLowerCase().endsWith('.json') ? name : `${name}.json`;

const writeToHandle = async (handle: FileSystemFileHandle, content: string): Promise<void> => {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
};

/**
 * File Adapter backed by the File System Access API (issue #54, ADR-0004):
 * Chromium's `showSaveFilePicker` / `showOpenFilePicker`. Holds the handle a
 * save picker returned, or one an open picker returned *and* the caller then
 * accepted via {@link confirmAssociation}, so a subsequent {@link save}
 * overwrites the same file without prompting again — matching spec §9
 * "Chromiumでは、初回に保存場所を選び、その後は同じファイルへ保存できる".
 *
 * `selectFileAdapter` only constructs this when `window.showSaveFilePicker`
 * exists, so callers never need their own feature check.
 */
export class FileSystemAccessAdapter implements FileAdapter {
  private handle: FileSystemFileHandle | null = null;
  /** Handle from the last {@link open}, held until the caller accepts its content. */
  private pendingHandle: FileSystemFileHandle | null = null;

  get hasAssociatedFile(): boolean {
    return this.handle !== null;
  }

  confirmAssociation(): void {
    if (this.pendingHandle !== null) {
      this.handle = this.pendingHandle;
      this.pendingHandle = null;
    }
  }

  clearAssociation(): void {
    this.handle = null;
    this.pendingHandle = null;
  }

  async save(content: string, suggestedName?: string): Promise<SaveResult | null> {
    if (this.handle === null) {
      return this.saveAs(content, suggestedName);
    }
    await writeToHandle(this.handle, content);
    return { fileName: this.handle.name };
  }

  async saveAs(content: string, suggestedName?: string): Promise<SaveResult | null> {
    if (window.showSaveFilePicker === undefined) {
      throw new Error('showSaveFilePicker is not available in this browser.');
    }
    let handle: FileSystemFileHandle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: suggestedName !== undefined ? withJsonExtension(suggestedName) : undefined,
        types: JSON_FILE_TYPES,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
    await writeToHandle(handle, content);
    this.handle = handle;
    return { fileName: handle.name };
  }

  async open(): Promise<OpenResult | null> {
    if (window.showOpenFilePicker === undefined) {
      throw new Error('showOpenFilePicker is not available in this browser.');
    }
    let handles: FileSystemFileHandle[];
    try {
      handles = await window.showOpenFilePicker({ multiple: false, types: JSON_FILE_TYPES });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
    const [handle] = handles;
    if (handle === undefined) {
      return null;
    }
    const file = await handle.getFile();
    const content = await file.text();
    // Held, not adopted: only `confirmAssociation` — called once the caller
    // has parsed and accepted the content — makes this the save destination.
    this.pendingHandle = handle;
    return { fileName: handle.name, content };
  }
}
