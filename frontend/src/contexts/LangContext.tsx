import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { LangContext, type Locale } from '@/contexts/langContext';
import {
  INTL_LOCALE,
  readStoredLocale,
  setCurrentLocale,
  storeLocale,
  translate,
  type TranslateParams,
} from '@/lib/i18n';

export function LangProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = readStoredLocale();
    setCurrentLocale(initial);
    return initial;
  });

  // Keep the non-React helpers and the document in step with the choice.
  useEffect(() => {
    setCurrentLocale(locale);
    storeLocale(locale);
    document.documentElement.lang = INTL_LOCALE[locale].split('-')[0];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  );

  return <LangContext.Provider value={{ t, locale, setLocale }}>{children}</LangContext.Provider>;
}
