export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('el-GR').format(value);
}
