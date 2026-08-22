import { Link } from 'react-router-dom';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useGetMyBookingsQuery } from '@/app/bookingsApi';
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
  const { data: bookings, isLoading, error, refetch } = useGetMyBookingsQuery();

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <h1 className="comfortaa-bold text-2xl font-bold text-neutral-900">Οι κρατήσεις μου</h1>
          <p className="comfortaa-regular mt-1 text-sm text-neutral-600">
            Όλες οι κρατήσεις εισιτηρίων που έχετε πραγματοποιήσει.
          </p>
        </div>

        {isLoading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorMessage
            message={apiErrorMessage(error, 'Δεν ήταν δυνατή η φόρτωση των κρατήσεων.')}
            onRetry={() => void refetch()}
          />
        ) : (bookings ?? []).length === 0 ? (
          <EmptyState
            title="Δεν έχετε κρατήσεις ακόμα"
            description="Μόλις κάνετε την πρώτη σας κράτηση, θα εμφανιστεί εδώ."
          >
            <Link
              to="/events"
              className="comfortaa-regular inline-block rounded-lg bg-[#6d28d9] px-4 py-2 text-sm text-white hover:bg-violet-700"
            >
              Αναζητήστε εκδηλώσεις
            </Link>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <div className="comfortaa-regular grid min-w-[36rem] grid-cols-[1fr_110px_110px_120px] bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>Εκδήλωση</div>
              <div>Εισιτήρια</div>
              <div>Κατάσταση</div>
              <div>Σύνολο</div>
            </div>
            <ul className="min-w-[36rem] divide-y divide-neutral-200">
              {(bookings ?? []).map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <Link
                    to={`/events/${encodeURIComponent(b.event_id)}`}
                    className="grid grid-cols-[1fr_110px_110px_120px] items-center hover:text-[#6d28d9]"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="comfortaa-regular truncate text-sm font-medium text-neutral-900">
                        {b.event?.title ?? 'Εκδήλωση'}
                      </p>
                      <p className="comfortaa-regular truncate text-xs text-neutral-500">
                        {[b.event?.venue, b.event?.city].filter(Boolean).join(', ')}
                        {b.event?.start_at ? ` • ${formatDate(b.event.start_at)}` : ''}
                      </p>
                      {b.event?.status === 'cancelled' && (
                        <p className="comfortaa-regular mt-0.5 text-xs font-medium text-[var(--nexus-red)]">
                          Η εκδήλωση ακυρώθηκε
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
                      {STATUS_LABEL[b.status] ?? b.status}
                    </div>
                    <div className="comfortaa-regular text-sm font-medium text-[#6d28d9]">
                      {b.total_cost.toFixed(2)} €
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
