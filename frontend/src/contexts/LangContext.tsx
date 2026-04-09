import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import yaml from 'js-yaml';
import enRaw from '@/locales/en.yaml?raw';
import grRaw from '@/locales/gr.yaml?raw';

const translations: Record<string, any> = {
  en: yaml.load(enRaw) as Record<string, any>,
  el: yaml.load(grRaw) as Record<string, any>,
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
      let result: any = translationSet;

      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
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
