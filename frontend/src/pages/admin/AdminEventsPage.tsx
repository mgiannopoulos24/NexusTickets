import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useGetAdminEventsQuery } from '@/app/eventsApi';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLang } from '@/contexts/langContextCore';
import { formatDate } from '@/helpers/formatDate';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { downloadAuthenticatedFile } from '@/lib/downloadExport';
import type { EventStatus } from '@/types/enums';

const PAGE_SIZE = 20;
const STATUSES: EventStatus[] = ['draft', 'published', 'completed', 'cancelled'];

const STATUS_COLOR: Record<EventStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  published: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-sky-100 text-sky-800',
  cancelled: 'bg-red-100 text-red-800',
  deleted: 'bg-neutral-100 text-neutral-500',
};

function parseStatus(raw: string | null): EventStatus | undefined {
  return raw && (STATUSES as string[]).includes(raw) ? (raw as EventStatus) : undefined;
}

function parseOffset(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n / PAGE_SIZE) * PAGE_SIZE : 0;
}

/** The administration's event list: search, status filter and paging live in the URL. */
export default function AdminEventsPage() {
  const { t } = useLang();
  const { accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const status = parseStatus(searchParams.get('status'));
  const offset = parseOffset(searchParams.get('offset'));
  // The box is typed into freely; the URL (and so the query) only changes on submit.
  const [draft, setDraft] = useState(q);

  const {
    data: page,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAdminEventsQuery({ q, status, limit: PAGE_SIZE, offset });

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  };

  const submitSearch = () =>
    update((next) => {
      if (draft.trim()) next.set('q', draft.trim());
      else next.delete('q');
      next.delete('offset');
    });

  const [exporting, setExporting] = useState<'xml' | 'json' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: 'xml' | 'json') => {
    if (!accessToken) {
      setExportError(t('adminEvents.sessionExpired'));
      return;
    }
    setExporting(format);
    setExportError(null);
    try {
      // The catalogue export lives under the admin group: /admin/events/export.
      await downloadAuthenticatedFile(
        `/api/v1/admin/events/export/${format}`,
        accessToken,
        `events.${format}`,
      );
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : t('adminEvents.exportError'));
    } finally {
      setExporting(null);
    }
  };

  const hasFilters = q !== '' || status !== undefined;
  const total = page?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + (page?.events.length ?? 0), total);

  return (
    <AdminLayout>
      <div className="bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="comfortaa-bold text-2xl font-bold text-neutral-950">
              {t('adminEvents.title')}
            </h1>
            <p className="comfortaa-regular mt-2 text-sm text-neutral-600">
              {t('adminEvents.subtitle')}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting !== null}
              onClick={() => void handleExport('xml')}
            >
              {exporting === 'xml' ? t('adminEvents.exporting') : t('adminEvents.exportXml')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting !== null}
              onClick={() => void handleExport('json')}
            >
              {exporting === 'json' ? t('adminEvents.exporting') : t('adminEvents.exportJson')}
            </Button>
          </div>
        </div>

        {exportError && <ErrorMessage className="mt-3" message={exportError} />}

        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <div className="min-w-[16rem] flex-1 space-y-1">
            <Label htmlFor="admin-events-q" className="comfortaa-regular text-xs">
              {t('adminEvents.searchLabel')}
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <Input
                id="admin-events-q"
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('adminEvents.searchPlaceholder')}
                className="comfortaa-regular pl-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-events-status" className="comfortaa-regular text-xs">
              {t('adminEvents.statusLabel')}
            </Label>
            <select
              id="admin-events-status"
              value={status ?? ''}
              onChange={(e) =>
                update((next) => {
                  if (e.target.value) next.set('status', e.target.value);
                  else next.delete('status');
                  next.delete('offset');
                })
              }
              className="comfortaa-regular h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="">{t('adminEvents.allStatuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.event.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline" className="comfortaa-regular">
            {t('adminEvents.searchLabel')}
          </Button>
        </form>

        {isLoading ? (
          <SkeletonList rows={6} className="mt-6" />
        ) : error ? (
          <ErrorMessage
            className="mt-6"
            message={apiErrorMessage(error, t('adminEvents.loadError'))}
            onRetry={() => void refetch()}
          />
        ) : !page || page.events.length === 0 ? (
          <EmptyState
            className="mt-6"
            title={t('adminEvents.emptyTitle')}
            description={hasFilters ? t('adminEvents.noMatch') : t('adminEvents.emptyBody')}
          />
        ) : (
          <div className={cn('mt-6', isFetching && 'opacity-70 transition-opacity')}>
            <p className="comfortaa-regular mb-2 text-xs text-neutral-500">
              {t('adminEvents.results', { count: total })}
            </p>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <div className="comfortaa-regular grid min-w-[38rem] grid-cols-[minmax(0,1fr)_150px_220px] bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
                <div>{t('adminEvents.colTitle')}</div>
                <div>{t('adminEvents.colStatus')}</div>
                <div>{t('adminEvents.colDates')}</div>
              </div>
              <ul className="min-w-[38rem] divide-y divide-neutral-200">
                {page.events.map((ev) => (
                  <li key={ev.id} className="px-4 py-3">
                    <Link
                      to={`/admin/events/${encodeURIComponent(ev.id)}/edit`}
                      className="grid grid-cols-[minmax(0,1fr)_150px_220px] items-center"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="comfortaa-regular truncate text-sm font-medium text-neutral-900">
                          {ev.title}
                        </p>
                        <p className="comfortaa-regular truncate text-xs text-neutral-500">
                          {ev.venue} • {ev.city}
                        </p>
                      </div>
                      <div className="text-xs">
                        <span
                          className={cn(
                            'comfortaa-regular inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_COLOR[ev.status] ?? 'bg-neutral-100 text-neutral-700',
                          )}
                        >
                          {t(`status.event.${ev.status}`)}
                        </span>
                      </div>
                      <div className="comfortaa-regular text-xs text-neutral-700">
                        {formatDate(ev.start_at)} – {formatDate(ev.end_at)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="comfortaa-regular flex items-center justify-between border-t border-neutral-200 px-3 py-2 text-xs text-neutral-600">
                <span>{t('common.rangeOf', { from, to, total })}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={offset === 0}
                    aria-label={t('common.previousPage')}
                    onClick={() =>
                      update((next) => {
                        const prev = Math.max(0, offset - PAGE_SIZE);
                        if (prev > 0) next.set('offset', String(prev));
                        else next.delete('offset');
                      })
                    }
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={offset + PAGE_SIZE >= total}
                    aria-label={t('common.nextPage')}
                    onClick={() => update((next) => next.set('offset', String(offset + PAGE_SIZE)))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
