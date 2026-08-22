import { useState, useCallback, type ReactNode } from 'react';

import { LangContext, translations, type Locale, type TranslationTree } from '@/contexts/langContext';

export function LangProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('el');

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string) => {
      const translationSet = translations[locale];
      if (!translationSet) return key;

      const keys = key.split('.');
      let result: TranslationTree = translationSet;

      for (const k of keys) {
        if (typeof result === 'string') return key;
        if (k in result) {
          result = result[k];
        } else {
          return key;
        }
      }

      return typeof result === 'string' ? result : key;
    },
    [locale],
  );

  return <LangContext.Provider value={{ t, locale, setLocale }}>{children}</LangContext.Provider>;
}
