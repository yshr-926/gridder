import { useEffect } from 'react';
import { useIsDirty } from './dirtyTracking';

/**
 * Confirms before the page unloads with unsaved changes (issue #54, spec §9:
 * "未保存の変更がある状態で...ページ離脱を行う場合は確認する"). Setting
 * `event.returnValue` is what actually triggers the browser's native prompt;
 * the string itself is ignored by every modern browser, which show their own
 * fixed wording instead.
 */
export const useBeforeUnload = (): void => {
  const dirty = useIsDirty();

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);
};
