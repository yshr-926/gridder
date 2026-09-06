import { useEffect } from 'react';
import { markCleanExit } from './cleanExitFlag';

/**
 * Marks the session as exiting cleanly on `pagehide` (issue #55, spec §9).
 * Mount once, near the app root — see `cleanExitFlag.ts` for why `pagehide`
 * rather than `beforeunload`.
 */
export const useTrackCleanExit = (): void => {
  useEffect(() => {
    window.addEventListener('pagehide', markCleanExit);
    return () => window.removeEventListener('pagehide', markCleanExit);
  }, []);
};
