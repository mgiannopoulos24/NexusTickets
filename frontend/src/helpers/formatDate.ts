export function formatDate(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat('el-GR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat('el-GR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat('el-GR', {
    month: 'short',
    day: '2-digit',
  }).format(date);
}
