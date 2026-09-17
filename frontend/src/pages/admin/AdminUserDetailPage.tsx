import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import {
  useApproveUserMutation,
  useChangeUserRoleMutation,
  useGetUserQuery,
  useRejectUserMutation,
} from '@/app/usersApi';
import { AssignableRoles, type AssignableRole } from '@/types/enums';
import { roleLabel, AccountStatusBadge } from '@/pages/admin/userDisplay';
import { useLang } from '@/contexts/langContextCore';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('el-GR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-neutral-100 py-3 last:border-b-0 sm:grid sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-medium text-neutral-500 comfortaa-regular">{label}</dt>
      <dd className="mt-1 text-sm text-neutral-900 comfortaa-regular sm:mt-0">{children || '—'}</dd>
    </div>
  );
}

export default function AdminUserDetailPage() {
  const { t } = useLang();
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const { data: user, isLoading, isError, error } = useGetUserQuery(id, { skip: !id });
  const [approveUser, { isLoading: approving }] = useApproveUserMutation();
  const [rejectUser, { isLoading: rejecting }] = useRejectUserMutation();
  const [changeRole, { isLoading: changingRole }] = useChangeUserRoleMutation();

  const [actionError, setActionError] = useState<string | null>(null);

  const busy = approving || rejecting || changingRole;

  const handleRoleChange = async (role: AssignableRole) => {
    setActionError(null);
    try {
      const updated = await changeRole({ id, role }).unwrap();
      toast.success(
        t('adminUser.roleChanged', { username: updated.username, role: roleLabel(updated.role) }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('adminUser.roleChangeFailed');
      setActionError(msg);
      toast.error(msg);
    }
  };

  const handleApprove = async () => {
    setActionError(null);
    try {
      const updated = await approveUser(id).unwrap();
      toast.success(t('adminUser.approved', { username: updated.username }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('adminUser.approveFailed');
      setActionError(msg);
      toast.error(msg);
    }
  };

  const handleReject = async () => {
    setActionError(null);
    try {
      const updated = await rejectUser(id).unwrap();
      toast.success(t('adminUser.rejected', { username: updated.username }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('adminUser.rejectFailed');
      setActionError(msg);
      toast.error(msg);
    }
  };

  return (
    <AdminLayout>
      <div className="bg-white p-4 sm:p-6">
        <button
          type="button"
          onClick={() => navigate('/admin/users')}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900 comfortaa-regular"
        >
          <ArrowLeft className="size-4" />
          {t('adminUser.backToUsers')}
        </button>

        {isLoading ? (
          <p className="text-sm text-neutral-600 comfortaa-regular">{t('adminUser.loading')}</p>
        ) : isError || !user ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">
            {(error as { message?: string })?.message ?? t('adminUser.notFound')}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--nexus-purple)] text-xl font-bold text-white comfortaa-bold">
                  {(user.first_name.charAt(0) || user.username.charAt(0)).toLocaleUpperCase(
                    'el-GR',
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">
                    {user.first_name} {user.last_name}
                  </h1>
                  <p className="mt-0.5 flex items-center gap-2 text-sm text-neutral-500 comfortaa-regular">
                    <span>@{user.username}</span>
                    <span aria-hidden>•</span>
                    <span>{roleLabel(user.role)}</span>
                  </p>
                </div>
              </div>
              <AccountStatusBadge status={user.account_status} />
            </div>

            {/* Approval actions */}
            {user.account_status === 'pending' ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800 comfortaa-regular">
                  {t('adminUser.pendingNotice')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleApprove()}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {approving ? t('adminUser.approving') : t('adminUser.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleReject()}
                    className="border-red-300 text-[var(--nexus-red)] hover:bg-red-50"
                  >
                    {rejecting ? t('adminUser.rejecting') : t('adminUser.reject')}
                  </Button>
                </div>
                {actionError && (
                  <p className="mt-2 text-sm text-[var(--nexus-red)] comfortaa-regular">
                    {actionError}
                  </p>
                )}
              </div>
            ) : user.account_status === 'approved' ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm text-neutral-600 comfortaa-regular">
                  {t('adminUser.activeNotice')}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleReject()}
                  className="border-red-300 text-[var(--nexus-red)] hover:bg-red-50"
                >
                  {rejecting ? t('adminUser.rejecting') : t('adminUser.revoke')}
                </Button>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm text-neutral-600 comfortaa-regular">
                  {t('adminUser.rejectedNotice')}
                </p>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleApprove()}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {approving ? t('adminUser.approving') : t('adminUser.approveNow')}
                </Button>
              </div>
            )}

            {/* Role: an account registers as attendee or organizer and an admin
                can move it between the two (assignment §6). Admin accounts are
                not switchable. */}
            {user.role !== 'admin' && (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
                <p className="text-sm font-medium text-neutral-900 comfortaa-bold">
                  {t('adminUser.roleTitle')}
                </p>
                <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
                  {t('adminUser.roleHint')}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label htmlFor="user-role" className="sr-only">
                    {t('adminUser.role')}
                  </label>
                  <select
                    id="user-role"
                    value={user.role}
                    disabled={busy}
                    onChange={(e) => void handleRoleChange(e.target.value as AssignableRole)}
                    className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm comfortaa-regular disabled:opacity-50"
                  >
                    {AssignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  {changingRole && (
                    <span className="text-sm text-neutral-500 comfortaa-regular">
                      {t('adminUser.saving')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Details */}
            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 comfortaa-regular">
                {t('adminUser.details')}
              </h2>
              <dl className="mt-2">
                <Field label="Email">{user.email}</Field>
                <Field label={t('adminUser.phone')}>{user.phone}</Field>
                <Field label={t('adminUser.vat')}>{user.vat_number}</Field>
                <Field label={t('adminUser.address')}>{user.address}</Field>
                <Field label={t('adminUser.city')}>{user.city}</Field>
                <Field label={t('adminUser.country')}>{user.country}</Field>
                <Field label={t('adminUser.geo')}>
                  {user.latitude != null && user.longitude != null
                    ? `${user.latitude}, ${user.longitude}`
                    : '—'}
                </Field>
                <Field label={t('adminUser.registered')}>{formatDateTime(user.created_at)}</Field>
                <Field label={t('adminUser.updated')}>{formatDateTime(user.updated_at)}</Field>
                <Field label="ID">
                  <span className="font-mono text-xs text-neutral-500">{user.id}</span>
                </Field>
              </dl>
            </div>

            <div className="mt-8">
              <Link
                to="/admin/users"
                className="text-sm text-[var(--nexus-purple)] underline-offset-2 hover:underline comfortaa-regular"
              >
                {t('adminUser.backToList')}
              </Link>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
