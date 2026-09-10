/**
 * "Was the last session closed cleanly?" flag (issue #55, spec §9: "正常終了
 * 後の通常起動ではドラフトを自動的に開かない。異常終了後だけ復元するか確認する").
 *
 * Stored in `localStorage` (not IndexedDB) because it must be set
 * synchronously from a `pagehide` handler with no time to await anything —
 * the page may already be gone by the time an async write would resolve.
 * Uses its own key, separate from the retired `features/export/autoSave.ts`'s
 * `gridder_autosave` / `gridder_autosave_time` keys, so this never touches
 * that module's data.
 *
 * Tracked with `pagehide`, not `beforeunload`: `beforeunload` fires even when
 * `features/file`'s `useBeforeUnload` shows the browser's native "leave
 * site?" prompt and the user then cancels, which would wrongly mark the
 * session clean while the page keeps running. `pagehide` only fires once the
 * page is actually being torn down (or placed in the back/forward cache),
 * so it never fires for a cancelled unload — no coordination with
 * `useBeforeUnload` beyond both listening for their own separate events.
 */

const CLEAN_EXIT_KEY = 'gridder-draft-clean-exit';

/** Mark the current session as exiting cleanly. Call from a `pagehide` listener. */
export const markCleanExit = (): void => {
  try {
    localStorage.setItem(CLEAN_EXIT_KEY, 'true');
  } catch {
    // localStorage unavailable (private browsing, quota) — nothing to do;
    // the next launch will just conservatively treat this as not-clean.
  }
};

/**
 * Clear the flag so this session starts "not clean" again — call once at
 * startup, before checking {@link wasCleanExit}, so a session that never
 * reaches its own `pagehide` (a crash, a killed tab) is correctly seen as
 * unclean the *next* time the app loads, while the current session's own
 * eventual clean exit still sets it back to `true`.
 */
export const clearCleanExitFlag = (): void => {
  try {
    localStorage.removeItem(CLEAN_EXIT_KEY);
  } catch {
    // Ignore — see markCleanExit.
  }
};

/** Whether the previous session ended cleanly, per the flag left by {@link markCleanExit}. */
export const wasCleanExit = (): boolean => {
  try {
    return localStorage.getItem(CLEAN_EXIT_KEY) === 'true';
  } catch {
    return false;
  }
};
