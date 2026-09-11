import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2Icon, FileTextIcon } from 'lucide-react';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useDeleteEventMutation, useGetOrganizerEventsQuery } from '@/app/eventsApi';
import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/models';
import { useLang } from '@/contexts/langContext';

const bookedSeats = (ev: Event): number => ev.tickets_sold ?? 0;

/** Deletion is allowed before publication, or before the first booking. */
const canDelete = (ev: Event): boolean =>
  ev.status === 'draft' || (ev.status === 'published' && bookedSeats(ev) === 0);

export default function OrganizerEventsPage() {
  const { t } = useLang();
  const { data: events, isLoading, error, refetch } = useGetOrganizerEventsQuery();
  const [deleteEvent, { isLoading: deleting }] = useDeleteEventMutation();

  const onDelete = async (ev: Event) => {
    if (!window.confirm(t('organizerEvents.confirmDelete', { title: ev.title }))) return;
    try {
      await deleteEvent(ev.id).unwrap();
      toast.success(t('organizerEvents.deleted'));
      // The list re-reads itself: deleteEvent invalidates the organizer tag.
    } catch (e) {
      toast.error(apiErrorMessage(e, t('organizerEvents.deleteFailed')));
    }
  };

  return (
    <OrganizerLayout>
      <div className="bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="comfortaa-bold text-2xl font-bold text-neutral-950">
              {t('organizerEvents.title')}
            </h1>
            <p className="comfortaa-regular mt-2 text-sm text-neutral-600">
              {t('organizerEvents.subtitle')}
            </p>
          </div>
          <Link
            to="/organizer/events/new"
            className="comfortaa-regular inline-flex shrink-0 items-center justify-center rounded-none border-2 border-[var(--nexus-purple)] bg-[var(--nexus-purple)] px-4 py-2 text-sm text-white hover:bg-[var(--nexus-purple-dark)]"
          >
            {t('organizerEvents.new')}
          </Link>
        </div>

        {isLoading ? (
          <SkeletonList rows={5} className="mt-6" />
        ) : error ? (
          <ErrorMessage
            className="mt-6"
            message={apiErrorMessage(error, t('organizerEvents.loadError'))}
            onRetry={() => void refetch()}
          />
        ) : (events ?? []).length === 0 ? (
          <EmptyState
            className="mt-6"
            title={t('organizerEvents.emptyTitle')}
            description={t('organizerEvents.emptyBody')}
          >
            <Link
              to="/organizer/events/new"
              className="comfortaa-regular inline-block rounded-lg bg-[var(--nexus-purple)] px-4 py-2 text-sm text-white hover:bg-[var(--nexus-purple-dark)]"
            >
              {t('organizerEvents.createFirst')}
            </Link>
          </EmptyState>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
            <div className="comfortaa-regular grid min-w-[46rem] grid-cols-[minmax(0,1fr)_140px_100px_220px_100px] bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>{t('organizerEvents.colTitle')}</div>
              <div>{t('organizerEvents.colStatus')}</div>
              <div>{t('organizerEvents.colBookings')}</div>
              <div>{t('organizerEvents.colDates')}</div>
              <div />
            </div>
            <ul
              className={cn('min-w-[46rem] divide-y divide-neutral-200', deleting && 'opacity-60')}
            >
              {(events ?? []).map((ev) => (
                <li key={ev.id} className="px-4 py-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_140px_100px_220px_100px] items-center">
                    <Link
                      to={`/organizer/events/${encodeURIComponent(ev.id)}/edit`}
                      className="min-w-0 pr-3"
                    >
                      <p className="comfortaa-regular truncate text-sm font-medium text-neutral-900 hover:text-[var(--nexus-purple)]">
                        {ev.title}
                      </p>
                      <p className="comfortaa-regular truncate text-xs text-neutral-500">
                        {ev.venue} • {ev.city}
                      </p>
                    </Link>
                    <div className="comfortaa-regular text-xs text-neutral-700">
                      {t(`status.event.${ev.status}`)}
                    </div>
                    <div className="comfortaa-regular text-xs text-neutral-700">
                      {bookedSeats(ev) > 0 ? (
                        <Link
                          to={`/organizer/events/${encodeURIComponent(ev.id)}/bookings`}
                          className="text-[var(--nexus-purple)] underline hover:no-underline"
                        >
                          {bookedSeats(ev)}
                        </Link>
                      ) : (
                        '0'
                      )}
                    </div>
                    <div className="comfortaa-regular text-xs whitespace-nowrap text-neutral-700">
                      {new Date(ev.start_at).toLocaleDateString('el-GR')} –{' '}
                      {new Date(ev.end_at).toLocaleDateString('el-GR')}
                    </div>
                    <div className="flex justify-end gap-2">
                      {bookedSeats(ev) > 0 && (
                        <Link
                          to={`/organizer/events/${encodeURIComponent(ev.id)}/bookings`}
                          title={t('organizerEvents.viewBookings')}
                        >
                          <Button variant="ghost" size="icon" className="size-8">
                            <FileTextIcon className="size-4" />
                          </Button>
                        </Link>
                      )}
                      {canDelete(ev) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleting}
                          className="size-8 text-neutral-500 hover:text-[var(--nexus-red)]"
                          title={t('organizerEvents.delete')}
                          onClick={() => void onDelete(ev)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </OrganizerLayout>
  );
}
