import type { AccountStatus, UserRole } from '@/types/enums';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

export function roleLabel(role: UserRole): string {
  return tr(`role.${role}`);
}

const ACCOUNT_STATUS_CLASS: Record<AccountStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-[var(--nexus-red)]',
};

export function accountStatusLabel(status: AccountStatus): string {
  return tr(`status.account.${status}Label`);
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const meta = {
    label: accountStatusLabel(status),
    className: ACCOUNT_STATUS_CLASS[status] ?? 'bg-neutral-100 text-neutral-700',
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
