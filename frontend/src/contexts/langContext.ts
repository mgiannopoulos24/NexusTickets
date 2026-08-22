import { createContext, useContext } from 'react';

import enTranslations from '@/locales/en.yaml';
import grTranslations from '@/locales/gr.yaml';

export type TranslationTree =
  | string
  | {
      readonly [key: string]: TranslationTree;
    };

export const translations: Record<'en' | 'el', TranslationTree> = {
  en: enTranslations as TranslationTree,
  el: grTranslations as TranslationTree,
};

export type Locale = keyof typeof translations;

export interface LangContextType {
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const LangContext = createContext<LangContextType | undefined>(undefined);

export function useLang() {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error('useLang must be used within a LangProvider');
  }
  return context;
}
