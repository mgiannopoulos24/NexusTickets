import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import type { Booking } from '@/types/models';
import { cn } from '@/lib/utils';

type ApiEnvelope<T> = { data: T | null; error?: { code: string; message: string } | null; meta?: unknown };

export default function EventBookingsPage() {
  const { id: eventId } = useParams();
  const { accessToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!eventId || !accessToken) {
      setError('missing params');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    fetch(`/api/v1/bookings/organizer/events/${encodeURIComponent(eventId)}?limit=100&offset=0`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        const json = (await res.json()) as ApiEnvelope<Booking[]>;
        if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης');
        if (!cancelled) setBookings(json.data ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Σφάλμα');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, accessToken]);

  const statusLabel = (s: string | undefined): string => {
    if (s === 'confirmed') return 'Επιβεβαιωμένη';
    if (s === 'pending') return 'Εκκρεμής';
    if (s === 'cancelled') return 'Ακυρωμένη';
    return s ?? '—';
  };

  const statusColor = (s: string | undefined): string => {
    if (s === 'confirmed') return 'bg-emerald-100 text-emerald-800';
    if (s === 'pending') return 'bg-amber-100 text-amber-800';
    if (s === 'cancelled') return 'bg-red-100 text-red-800';
    return 'bg-neutral-100 text-neutral-800';
  };

  return (
    <OrganizerLayout>
      <div className="bg-white p-6">
        <div className="mb-6">
          <p className="text-xs text-neutral-500 comfortaa-regular">
            <Link to="/organizer/events" className="hover:underline">
              Οι εκδηλώσεις μου
            </Link>{' '}
            / Κρατήσεις
          </p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-950 comfortaa-bold">Κρατήσεις</h1>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</p>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">{error}</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-neutral-600 comfortaa-regular">
            Δεν υπάρχουν κρατήσεις για αυτήν την εκδήλωση.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="grid grid-cols-[1fr_100px_120px_100px] gap-0 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600 comfortaa-regular">
              <div>Συμμετέχων</div>
              <div>Εισιτήρια</div>
              <div>Κατάσταση</div>
              <div>Σύνολο</div>
            </div>
            <ul className="divide-y divide-neutral-200">
              {bookings.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <div className="grid grid-cols-[1fr_100px_120px_100px] items-center gap-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 comfortaa-regular">
                        {b.attendee?.username ?? b.attendee_id}
                      </p>
                      <p className="truncate text-xs text-neutral-500 comfortaa-regular">
                        {b.attendee?.first_name} {b.attendee?.last_name}
                      </p>
                    </div>
                    <div className="text-xs text-neutral-700 comfortaa-regular">
                      {b.number_of_tickets}
                    </div>
                    <div className="text-xs">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium comfortaa-regular',
                          statusColor(b.status),
                        )}
                      >
                        {statusLabel(b.status)}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[#6d28d9] comfortaa-regular">
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