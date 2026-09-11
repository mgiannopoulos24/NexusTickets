import { createContext, useContext } from 'react';

import type { Locale, TranslateParams } from '@/lib/i18n';

export type { Locale, TranslationTree } from '@/lib/i18n';
export { translations } from '@/lib/i18n';

export interface LangContextType {
  t: (key: string, params?: TranslateParams) => string;
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
