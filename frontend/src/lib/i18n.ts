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

/** BCP 47 tag per locale, for Intl formatting and <html lang>. */
export const INTL_LOCALE: Record<Locale, string> = { el: 'el-GR', en: 'en-GB' };

const STORAGE_KEY = 'nexustickets.locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'el' || value === 'en';
}

/** The locale the user chose last time, or Greek. */
export function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : 'el';
  } catch {
    return 'el';
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Private mode or blocked storage: the choice simply does not persist.
  }
}

// The provider keeps this in step with React state so code outside components
// (formatters, validation messages, API error fallbacks) speaks the same
// language as the page.
let currentLocale: Locale = 'el';

export function getLocale(): Locale {
  return currentLocale;
}

export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
}

export type TranslateParams = Record<string, string | number>;

function lookup(locale: Locale, key: string): string | undefined {
  let node: TranslationTree = translations[locale];
  for (const part of key.split('.')) {
    if (typeof node === 'string' || !(part in node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Resolves a dotted key in the given locale, falling back to Greek and then
 * to the key itself (so a missing entry is visible, never blank). `{name}`
 * placeholders are filled from `params`.
 */
export function translate(locale: Locale, key: string, params?: TranslateParams): string {
  const raw = lookup(locale, key) ?? lookup('el', key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Translate in the current locale; for code that runs outside React. */
export function tr(key: string, params?: TranslateParams): string {
  return translate(currentLocale, key, params);
}
