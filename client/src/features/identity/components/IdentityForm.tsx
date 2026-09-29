import { useEffect, useRef } from 'react';
import { localizeCode, type Strings } from '../../../i18n';

export function localize(t: Strings, code: string | null | undefined): string {
  return localizeCode(t, code);
}

/** Move keyboard focus to the view title on navigation. */
export function useTitleFocus(): React.RefObject<HTMLHeadingElement> {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

export function fieldError(t: Strings, code: string | undefined, field: string | undefined): string | undefined {
  if (code === undefined) return undefined;
  if (code === 'VALIDATION_ERROR' && field !== undefined) return t.err_VALIDATION_ERROR;
  return localize(t, code);
}
