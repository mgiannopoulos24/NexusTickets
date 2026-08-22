import { Link, useParams } from 'react-router-dom';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useGetEventBookingsQuery } from '@/app/bookingsApi';
import { useGetEventQuery } from '@/app/eventsApi';
import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/types/enums';

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Επιβεβαιωμένη',
  pending: 'Εκκρεμής',
  cancelled: 'Ακυρωμένη',
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function EventBookingsPage() {
  const { id: eventId = '' } = useParams();

  const {
    data: bookings,
    isLoading,
    error,
    refetch,
  } = useGetEventBookingsQuery({ eventId }, { skip: !eventId });

  const { data: event } = useGetEventQuery(eventId, { skip: !eventId });

  const totalSeats = (bookings ?? []).reduce((acc, b) => acc + b.quantity, 0);
  const totalRevenue = (bookings ?? []).reduce((acc, b) => acc + b.total_cost, 0);

  return (
    <OrganizerLayout>
      <div className="bg-white p-6">
        <div className="mb-6">
          <p className="comfortaa-regular text-xs text-neutral-500">
            <Link to="/organizer/events" className="hover:underline">
              Οι εκδηλώσεις μου
            </Link>{' '}
            / Κρατήσεις
          </p>
          <h1 className="comfortaa-bold mt-1 text-2xl font-bold text-neutral-950">
            {event?.title ?? 'Κρατήσεις'}
          </h1>
          {(bookings ?? []).length > 0 && (
            <p className="comfortaa-regular mt-1 text-sm text-neutral-600">
              {bookings?.length} κρατήσεις · {totalSeats} θέσεις · {totalRevenue.toFixed(2)} € σύνολο
            </p>
          )}
        </div>

        {isLoading ? (
          <SkeletonList rows={5} />
        ) : error ? (
          <ErrorMessage
            message={apiErrorMessage(error, 'Δεν ήταν δυνατή η φόρτωση των κρατήσεων.')}
            onRetry={() => void refetch()}
          />
        ) : (bookings ?? []).length === 0 ? (
          <EmptyState
            title="Καμία κράτηση"
            description="Δεν υπάρχουν κρατήσεις για αυτήν την εκδήλωση ακόμη."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <div className="comfortaa-regular grid min-w-[40rem] grid-cols-[1fr_120px_110px_130px_110px] bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>Συμμετέχων</div>
              <div>Εισιτήριο</div>
              <div>Θέσεις</div>
              <div>Κατάσταση</div>
              <div>Σύνολο</div>
            </div>
            <ul className="min-w-[40rem] divide-y divide-neutral-200">
              {(bookings ?? []).map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <div className="grid grid-cols-[1fr_120px_110px_130px_110px] items-center">
                    <div className="min-w-0 pr-3">
                      <p className="comfortaa-regular truncate text-sm font-medium text-neutral-900">
                        {b.attendee?.full_name?.trim() || b.attendee?.username || 'Συμμετέχων'}
                      </p>
                      <p className="comfortaa-regular truncate text-xs text-neutral-500">
                        {b.attendee?.email ?? ''}
                      </p>
                    </div>
                    <div className="comfortaa-regular truncate pr-2 text-xs text-neutral-700">
                      {b.ticket_type?.name ?? '—'}
                    </div>
                    <div className="comfortaa-regular text-xs text-neutral-700">{b.quantity}</div>
                    <div className="text-xs">
                      <span
                        className={cn(
                          'comfortaa-regular inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_COLOR[b.status] ?? 'bg-neutral-100 text-neutral-800',
                        )}
                      >
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </div>
                    <div className="comfortaa-regular text-sm font-medium text-[#6d28d9]">
                      {b.total_cost.toFixed(2)} €
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
