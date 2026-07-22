/* eslint-disable react-refresh/only-export-components */
import type { AccountStatus, UserRole } from '@/types/enums';
import { cn } from '@/lib/utils';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Διαχειριστής',
  organizer: 'Διοργανωτής',
  attendee: 'Συμμετέχων',
  guest: 'Επισκέπτης',
};

export const ACCOUNT_STATUS_META: Record<
  AccountStatus,
  { label: string; className: string }
> = {
  pending: { label: 'Εκκρεμεί', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Εγκεκριμένος', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Απορρίφθηκε', className: 'bg-red-50 text-[var(--nexus-red)]' },
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const meta = ACCOUNT_STATUS_META[status] ?? {
    label: status,
    className: 'bg-neutral-100 text-neutral-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium comfortaa-regular',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}
