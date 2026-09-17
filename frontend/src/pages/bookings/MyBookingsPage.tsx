import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useGetMyBookingsQuery } from '@/app/bookingsApi';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/types/enums';
import { useLang } from '@/contexts/langContextCore';

const STATUS_COLOR: Record<BookingStatus, string> = {
  confirmed: 'text-emerald-700',
  pending: 'text-amber-700',
  cancelled: 'text-red-700',
};

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('el-GR');
}

export default function MyBookingsPage() {
  const { t } = useLang();
  const { data: bookings, isLoading, error, refetch } = useGetMyBookingsQuery();

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <h1 className="comfortaa-bold text-2xl font-bold text-neutral-900">
            {t('myBookings.title')}
          </h1>
          <p className="comfortaa-regular mt-1 text-sm text-neutral-600">
            {t('myBookings.subtitle')}
          </p>
        </div>

        {isLoading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorMessage
            message={apiErrorMessage(error, t('myBookings.loadError'))}
            onRetry={() => void refetch()}
          />
        ) : (bookings ?? []).length === 0 ? (
          <EmptyState title={t('myBookings.emptyTitle')} description={t('myBookings.emptyBody')}>
            <Link
              to="/events"
              className="comfortaa-regular inline-block rounded-lg bg-[var(--nexus-purple)] px-4 py-2 text-sm text-white hover:bg-violet-700"
            >
              {t('myBookings.browse')}
            </Link>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <div className="comfortaa-regular grid min-w-[40rem] grid-cols-[1fr_110px_110px_120px_44px] bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>{t('myBookings.colEvent')}</div>
              <div>{t('myBookings.colTickets')}</div>
              <div>{t('myBookings.colStatus')}</div>
              <div>{t('myBookings.colTotal')}</div>
              <div>
                <span className="sr-only">{t('myBookings.contact')}</span>
              </div>
            </div>
            <ul className="min-w-[40rem] divide-y divide-neutral-200">
              {(bookings ?? []).map((b) => (
                <li key={b.id} className="grid grid-cols-[1fr_44px] items-center px-4 py-3">
                  <Link
                    to={`/events/${encodeURIComponent(b.event_id)}`}
                    className="grid grid-cols-[1fr_110px_110px_120px] items-center hover:text-[var(--nexus-purple)]"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="comfortaa-regular truncate text-sm font-medium text-neutral-900">
                        {b.event?.title ?? t('common.event')}
                      </p>
                      <p className="comfortaa-regular truncate text-xs text-neutral-500">
                        {[b.event?.venue, b.event?.city].filter(Boolean).join(', ')}
                        {b.event?.start_at ? ` • ${formatDate(b.event.start_at)}` : ''}
                      </p>
                      {b.event?.status === 'cancelled' && (
                        <p className="comfortaa-regular mt-0.5 text-xs font-medium text-[var(--nexus-red)]">
                          {t('myBookings.eventCancelled')}
                        </p>
                      )}
                    </div>
                    <div className="comfortaa-regular text-xs text-neutral-700">
                      {b.quantity}
                      {b.ticket_type?.name ? (
                        <span className="block text-[11px] text-neutral-500">
                          {b.ticket_type.name}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        'comfortaa-regular text-xs font-medium',
                        STATUS_COLOR[b.status] ?? 'text-neutral-700',
                      )}
                    >
                      {t(`status.booking.${b.status}`)}
                    </div>
                    <div className="comfortaa-regular text-sm font-medium text-[var(--nexus-purple)]">
                      {b.total_cost.toFixed(2)} €
                    </div>
                  </Link>
                  {/* A booking opens the line to the organizer (assignment §10). */}
                  {b.event?.organizer_id ? (
                    <Link
                      to={`/messages?compose=1&to=${encodeURIComponent(b.event.organizer_id)}&event=${encodeURIComponent(b.event_id)}&subject=${encodeURIComponent(t('myBookings.messageSubject', { title: b.event.title }))}`}
                      className="inline-flex size-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-violet-50 hover:text-[var(--nexus-purple)]"
                      aria-label={t('myBookings.messageOrganizerFor', { title: b.event.title })}
                      title={t('myBookings.messageOrganizer')}
                    >
                      <MessageSquare className="size-4" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
