import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import enTranslations from '@/locales/en.yaml';
import grTranslations from '@/locales/gr.yaml';

type TranslationTree =
  | string
  | {
      readonly [key: string]: TranslationTree;
    };

const translations: Record<'en' | 'el', TranslationTree> = {
  en: enTranslations as TranslationTree,
  el: grTranslations as TranslationTree,
};

type Locale = keyof typeof translations;

interface LangContextType {
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LangContext = createContext<LangContextType | undefined>(undefined);

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

export function useLang() {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error('useLang must be used within a LangProvider');
  }
  return context;
}
