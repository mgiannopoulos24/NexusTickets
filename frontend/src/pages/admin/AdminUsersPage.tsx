import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { useListUsersQuery } from '@/app/usersApi';
import {
  ACCOUNT_STATUS_META,
  ROLE_LABELS,
  AccountStatusBadge,
} from '@/pages/admin/userDisplay';
import type { AccountStatus } from '@/types/enums';
import { cn } from '@/lib/utils';

// The DB holds few users (seeded accounts + real registrations), so we fetch a
// generous page once and filter / paginate on the client. This keeps the
// pending-approval workflow correct (no page can hide pending users).
const FETCH_LIMIT = 500;
const PAGE_SIZE = 15;

type StatusTab = AccountStatus | 'all';

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'Όλοι' },
  { value: 'pending', label: 'Εκκρεμείς' },
  { value: 'approved', label: 'Εγκεκριμένοι' },
  { value: 'rejected', label: 'Απορριφθέντες' },
];

export default function AdminUsersPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useListUsersQuery({
    limit: FETCH_LIMIT,
    offset: 0,
  });

  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const users = useMemo(() => data ?? [], [data]);

  const pendingCount = useMemo(
    () => users.filter((u) => u.account_status === 'pending').length,
    [users],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('el-GR');
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.account_status !== statusFilter) return false;
      if (!q) return true;
      const haystack =
        `${u.username} ${u.first_name} ${u.last_name} ${u.email}`.toLocaleLowerCase('el-GR');
      return haystack.includes(q);
    });
  }, [users, statusFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const changeFilter = (value: StatusTab) => {
    setStatusFilter(value);
    setPage(0);
  };

  return (
    <AdminLayout>
      <div className="bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">Χρήστες</h1>
            <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
              Επισκόπηση χρηστών, έγκριση ή απόρριψη νέων αιτήσεων εγγραφής.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 comfortaa-regular">
                {pendingCount} εκκρεμ{pendingCount === 1 ? 'εί' : 'ούν'}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? 'Ανανέωση…' : 'Ανανέωση'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => changeFilter(tab.value)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors comfortaa-regular',
                    active
                      ? 'bg-[var(--nexus-purple)] text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Αναζήτηση ονόματος, email…"
            className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--nexus-purple)] comfortaa-regular"
          />
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</p>
        ) : isError ? (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">
            {(error as { message?: string })?.message ?? 'Σφάλμα φόρτωσης χρηστών'}
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 rounded-lg bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500 comfortaa-regular">
            Δεν βρέθηκαν χρήστες.
          </p>
        ) : (
          <>
            <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200">
              <div className="grid min-w-[720px] grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_120px_140px] gap-0 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600 comfortaa-regular">
                <div>Χρήστης</div>
                <div>Email</div>
                <div>Ρόλος</div>
                <div>Κατάσταση</div>
              </div>
              <ul className="divide-y divide-neutral-200">
                {pageItems.map((u) => (
                  <li key={u.id} className="px-4 py-3 transition-colors hover:bg-neutral-50">
                    <Link
                      to={`/admin/users/${encodeURIComponent(u.id)}`}
                      className="grid min-w-[720px] grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_120px_140px] items-center gap-0"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="truncate text-sm font-medium text-neutral-900 comfortaa-regular">
                          {u.first_name} {u.last_name}
                        </p>
                        <p className="truncate text-xs text-neutral-500 comfortaa-regular">
                          @{u.username}
                        </p>
                      </div>
                      <div className="truncate pr-3 text-sm text-neutral-700 comfortaa-regular">
                        {u.email}
                      </div>
                      <div className="text-xs text-neutral-700 comfortaa-regular">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </div>
                      <div>
                        <AccountStatusBadge status={u.account_status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm text-neutral-600 comfortaa-regular">
              <span>
                {filtered.length} {filtered.length === 1 ? 'χρήστης' : 'χρήστες'}
                {statusFilter !== 'all'
                  ? ` (${ACCOUNT_STATUS_META[statusFilter].label.toLocaleLowerCase('el-GR')})`
                  : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Προηγούμενη
                </Button>
                <span className="px-1">
                  {safePage + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Επόμενη
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
