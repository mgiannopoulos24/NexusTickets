import { Link, useSearchParams } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';

import { apiErrorMessage } from '@/app/apiEnvelope';
import {
  useGetSupportCountsQuery,
  useGetTicketQuery,
  useListAllTicketsQuery,
} from '@/app/supportApi';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { TicketList } from '@/components/support/TicketList';
import { TicketThread } from '@/components/support/TicketThread';
import { ticketStatusLabel } from '@/components/support/ticketStatus';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { cn } from '@/lib/utils';
import type { SupportTicketStatus } from '@/types/support';
import { useLang } from '@/contexts/langContextCore';

const PAGE_SIZE = 20;
const FILTERS: Array<SupportTicketStatus | 'all'> = ['open', 'answered', 'closed', 'all'];

function parseStatus(raw: string | null): SupportTicketStatus | undefined {
  return raw === 'open' || raw === 'answered' || raw === 'closed' ? raw : undefined;
}

function parseOffset(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n / PAGE_SIZE) * PAGE_SIZE : 0;
}

/** The administration's support queue: filter by status, open a thread, reply, close. */
export default function AdminSupportPage() {
  const { t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  // Defaults to the tickets waiting on the administration.
  const status = searchParams.has('status') ? parseStatus(searchParams.get('status')) : 'open';
  const offset = parseOffset(searchParams.get('offset'));
  const openId = searchParams.get('id');

  const { data: counts } = useGetSupportCountsQuery();
  const {
    data: page,
    isLoading,
    error,
    refetch,
  } = useListAllTicketsQuery({ status, limit: PAGE_SIZE, offset }, { skip: Boolean(openId) });
  const {
    data: thread,
    isLoading: threadLoading,
    error: threadError,
  } = useGetTicketQuery(openId ?? '', { skip: !openId });

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  };
  const filterHref = (f: SupportTicketStatus | 'all') => `/admin/support?status=${f}`;
  const listHref = `/admin/support?status=${status ?? 'all'}${offset ? `&offset=${offset}` : ''}`;

  return (
    <AdminLayout>
      <div className="bg-white p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="comfortaa-bold text-2xl font-bold text-neutral-950">
            {t('support.admin.title')}
          </h1>
          <p className="comfortaa-regular mt-1 text-sm text-neutral-600">
            {counts
              ? t('support.admin.counts', {
                  open: counts.open,
                  answered: counts.answered,
                  closed: counts.closed,
                })
              : t('support.admin.subtitle')}
          </p>
        </div>

        {openId ? (
          threadLoading ? (
            <SkeletonList rows={3} />
          ) : threadError || !thread ? (
            <ErrorMessage
              message={apiErrorMessage(threadError, t('support.notFound'))}
              onRetry={() => update((next) => next.delete('id'))}
            />
          ) : (
            <TicketThread thread={thread} backHref={listHref} asAdmin />
          )
        ) : (
          <>
            <nav aria-label={t('support.admin.filter')} className="mb-4 flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const active = (status ?? 'all') === f;
                return (
                  <Link
                    key={f}
                    to={filterHref(f)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'comfortaa-regular rounded-lg border px-3 py-1.5 text-sm',
                      active
                        ? 'border-[var(--nexus-purple)] bg-violet-50 font-semibold text-[var(--nexus-purple)]'
                        : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100',
                    )}
                  >
                    {f === 'all' ? t('support.admin.all') : ticketStatusLabel(f)}
                    {f !== 'all' && counts ? ` (${counts[f]})` : ''}
                  </Link>
                );
              })}
            </nav>

            {isLoading ? (
              <SkeletonList rows={5} />
            ) : error ? (
              <ErrorMessage
                message={apiErrorMessage(error, t('support.loadError'))}
                onRetry={() => void refetch()}
              />
            ) : !page || page.total === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title={t('support.admin.emptyTitle')}
                description={t('support.admin.emptyBody')}
              />
            ) : (
              <TicketList
                page={page}
                showOwner
                hrefFor={(id) => `${listHref}&id=${encodeURIComponent(id)}`}
                onPageChange={(next) =>
                  update((p) => {
                    if (next > 0) p.set('offset', String(next));
                    else p.delete('offset');
                  })
                }
              />
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
