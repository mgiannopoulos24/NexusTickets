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
import type { EventStatus } from '@/types/enums';
import type { Event } from '@/types/models';

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Πρόχειρο',
  published: 'Δημοσιευμένο',
  completed: 'Ολοκληρωμένο',
  cancelled: 'Ακυρωμένο',
  deleted: 'Διαγραμμένο',
};

const bookedSeats = (ev: Event): number => ev.tickets_sold ?? 0;

/** Deletion is allowed before publication, or before the first booking. */
const canDelete = (ev: Event): boolean =>
  ev.status === 'draft' || (ev.status === 'published' && bookedSeats(ev) === 0);

export default function OrganizerEventsPage() {
  const { data: events, isLoading, error, refetch } = useGetOrganizerEventsQuery();
  const [deleteEvent, { isLoading: deleting }] = useDeleteEventMutation();

  const onDelete = async (ev: Event) => {
    if (!window.confirm(`Διαγραφή «${ev.title}»; Η ενέργεια δεν αναιρείται.`)) return;
    try {
      await deleteEvent(ev.id).unwrap();
      toast.success('Η εκδήλωση διαγράφηκε');
      // The list re-reads itself: deleteEvent invalidates the organizer tag.
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Η διαγραφή απέτυχε'));
    }
  };

  return (
    <OrganizerLayout>
      <div className="bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="comfortaa-bold text-2xl font-bold text-neutral-950">
              Οι εκδηλώσεις μου
            </h1>
            <p className="comfortaa-regular mt-2 text-sm text-neutral-600">
              Δημιουργία, επεξεργασία και δημοσίευση των εκδηλώσεών σας.
            </p>
          </div>
          <Link
            to="/organizer/events/new"
            className="comfortaa-regular inline-flex shrink-0 items-center justify-center rounded-none border-2 border-[#6d28d9] bg-[#6d28d9] px-4 py-2 text-sm text-white hover:bg-[#5b21b6]"
          >
            Νέα εκδήλωση
          </Link>
        </div>

        {isLoading ? (
          <SkeletonList rows={5} className="mt-6" />
        ) : error ? (
          <ErrorMessage
            className="mt-6"
            message={apiErrorMessage(error, 'Δεν ήταν δυνατή η φόρτωση των εκδηλώσεων.')}
            onRetry={() => void refetch()}
          />
        ) : (events ?? []).length === 0 ? (
          <EmptyState
            className="mt-6"
            title="Δεν υπάρχουν εκδηλώσεις ακόμα"
            description="Δημιουργήστε την πρώτη σας εκδήλωση για να αρχίσετε να δέχεστε κρατήσεις."
          >
            <Link
              to="/organizer/events/new"
              className="comfortaa-regular inline-block rounded-lg bg-[#6d28d9] px-4 py-2 text-sm text-white hover:bg-[#5b21b6]"
            >
              Δημιουργήστε την πρώτη σας
            </Link>
          </EmptyState>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
            <div className="comfortaa-regular grid min-w-[46rem] grid-cols-[minmax(0,1fr)_140px_100px_220px_100px] bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>Τίτλος</div>
              <div>Κατάσταση</div>
              <div>Κρατήσεις</div>
              <div>Ημερομηνίες</div>
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
                      <p className="comfortaa-regular truncate text-sm font-medium text-neutral-900 hover:text-[#6d28d9]">
                        {ev.title}
                      </p>
                      <p className="comfortaa-regular truncate text-xs text-neutral-500">
                        {ev.venue} • {ev.city}
                      </p>
                    </Link>
                    <div className="comfortaa-regular text-xs text-neutral-700">
                      {STATUS_LABEL[ev.status] ?? ev.status}
                    </div>
                    <div className="comfortaa-regular text-xs text-neutral-700">
                      {bookedSeats(ev) > 0 ? (
                        <Link
                          to={`/organizer/events/${encodeURIComponent(ev.id)}/bookings`}
                          className="text-[#6d28d9] underline hover:no-underline"
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
                          title="Προβολή κρατήσεων"
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
                          title="Διαγραφή"
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
