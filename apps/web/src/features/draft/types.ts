/**
 * Storage Adapter for the crash-recovery draft (issue #55, spec §9: "未保存
 * 内容はクラッシュ復元専用のドラフトとしてブラウザ内へ一時保持する"). Distinct from
 * `features/file`'s `FileAdapter` (a user-initiated `.json` save/open) — this
 * one holds exactly one draft, written automatically and silently, never
 * exposed to the user as a file.
 */
export interface DraftStorageAdapter {
  /** Write `content` (the serialized document) as the current draft, replacing any previous one. */
  save(content: string): Promise<void>;
  /** Read the current draft, or `null` if none exists. */
  load(): Promise<string | null>;
  /** Remove the draft, if any. */
  clear(): Promise<void>;
}
