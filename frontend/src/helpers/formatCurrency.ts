import { INTL_LOCALE, getLocale } from '@/lib/i18n';

export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(INTL_LOCALE[getLocale()], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[getLocale()]).format(value);
}
