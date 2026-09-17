import { Link } from 'react-router-dom';
import { Users, CalendarDays, Download } from 'lucide-react';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { useListUsersQuery } from '@/app/usersApi';
import { useLang } from '@/contexts/langContextCore';

export default function AdminDashboard() {
  const { t } = useLang();
  const { data: users } = useListUsersQuery({ limit: 500, offset: 0 });
  const total = users?.length ?? 0;
  const pending = users?.filter((u) => u.account_status === 'pending').length ?? 0;

  return (
    <AdminLayout>
      <div className="bg-white p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">
          {t('adminDash.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-neutral-600 comfortaa-regular">{t('adminDash.intro')}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/admin/users"
            className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-[var(--nexus-purple)] hover:bg-neutral-50"
          >
            <div className="flex items-center justify-between">
              <Users className="size-6 text-[var(--nexus-purple)]" />
              {pending > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 comfortaa-regular">
                  {t(pending === 1 ? 'adminUsers.pendingOne' : 'adminUsers.pendingMany', {
                    count: pending,
                  })}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-neutral-900 comfortaa-bold">
              {t('adminDash.users')}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              {t('adminDash.usersHint', { total })}
            </p>
          </Link>

          <Link
            to="/admin/events"
            className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-[var(--nexus-purple)] hover:bg-neutral-50"
          >
            <CalendarDays className="size-6 text-[var(--nexus-purple)]" />
            <h2 className="mt-3 text-lg font-semibold text-neutral-900 comfortaa-bold">
              {t('adminDash.events')}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              {t('adminDash.eventsHint')}
            </p>
          </Link>

          <Link
            to="/admin/events"
            className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-[var(--nexus-purple)] hover:bg-neutral-50"
          >
            <Download className="size-6 text-[var(--nexus-purple)]" />
            <h2 className="mt-3 text-lg font-semibold text-neutral-900 comfortaa-bold">
              {t('adminDash.exports')}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              {t('adminDash.exportsHint')}
            </p>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
