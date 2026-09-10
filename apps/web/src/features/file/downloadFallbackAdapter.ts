import type { FileAdapter, OpenResult, SaveResult } from './types';

const withJsonExtension = (name: string): string =>
  name.toLowerCase().endsWith('.json') ? name : `${name}.json`;

/** Trigger a browser download of `content` as `fileName`, then release the object URL. */
const downloadJson = (content: string, fileName: string): void => {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Opens the browser's file picker via a hidden `<input type=file>` and resolves with the chosen file, or `null` if the user cancels. */
const pickJsonFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    // There is no cancel event for <input type=file>; `focus` on the window
    // fires when the native picker dialog closes, one tick after a `change`
    // would have fired for a real pick, so scheduling the "nothing chosen"
    // resolution after that tick lets a real selection win the race.
    const handleChange = () => {
      window.removeEventListener('focus', handleFocus);
      resolve(input.files?.[0] ?? null);
    };
    const handleFocus = () => {
      window.removeEventListener('change', handleChange);
      setTimeout(() => {
        if (input.files === null || input.files.length === 0) {
          resolve(null);
        }
      }, 0);
    };

    input.addEventListener('change', handleChange, { once: true });
    window.addEventListener('focus', handleFocus, { once: true });
    input.click();
  });

/**
 * File Adapter for browsers without the File System Access API (issue #54,
 * ADR-0004: Firefox and Safari, "対応する標準 API が利用できない間はファイル選択に
 * よる読み込みとダウンロードによる保存"). There is no writable handle to hold, so
 * every save downloads a new file and {@link hasAssociatedFile} is always
 * `false` — "the same file" is not something a web page can overwrite here.
 */
export class DownloadFallbackAdapter implements FileAdapter {
  readonly hasAssociatedFile = false;

  /** No handle to adopt: every save downloads a new file. */
  confirmAssociation(): void {}

  /** Nothing is ever associated, so there is nothing to forget. */
  clearAssociation(): void {}

  async save(content: string, suggestedName?: string): Promise<SaveResult | null> {
    return this.saveAs(content, suggestedName);
  }

  async saveAs(content: string, suggestedName?: string): Promise<SaveResult | null> {
    const fileName = withJsonExtension(suggestedName ?? 'sketch');
    downloadJson(content, fileName);
    return { fileName };
  }

  async open(): Promise<OpenResult | null> {
    const file = await pickJsonFile();
    if (file === null) {
      return null;
    }
    const content = await file.text();
    return { fileName: file.name, content };
  }
}
