const TIME = new Intl.DateTimeFormat('el-GR', { hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('el-GR', { weekday: 'long', day: 'numeric', month: 'long' });
const DAY_WITH_YEAR = new Intl.DateTimeFormat('el-GR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "14:32" — the timestamp under a bubble. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : TIME.format(d);
}

/** "Σήμερα" / "Χθες" / "Δευτέρα 5 Οκτωβρίου" — the separator between days. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return 'Σήμερα';
  if (days === 1) return 'Χθες';
  if (d.getFullYear() !== now.getFullYear()) return DAY_WITH_YEAR.format(d);
  return DAY.format(d);
}

/** Compact stamp for the conversation list: time today, weekday this week, else a date. */
export function listTimestamp(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return TIME.format(d);
  if (days === 1) return 'Χθες';
  if (days < 7) return d.toLocaleDateString('el-GR', { weekday: 'short' });
  return d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' });
}

/** True when two messages are far enough apart to deserve a new day separator. */
export function isNewDay(prevISO: string | undefined, iso: string): boolean {
  if (!prevISO) return true;
  const a = new Date(prevISO);
  const b = new Date(iso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return startOfDay(a) !== startOfDay(b);
}
