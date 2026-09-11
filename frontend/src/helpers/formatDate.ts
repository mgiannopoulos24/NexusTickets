import { INTL_LOCALE, getLocale } from '@/lib/i18n';

function intl(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(INTL_LOCALE[getLocale()], options);
}

export function formatDate(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return intl({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function formatDateTime(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return intl({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return intl({ month: 'short', day: '2-digit' }).format(date);
}
