import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Booking } from '@/types/models';
import { cn } from '@/lib/utils';

type ApiEnvelope<T> = { data: T | null; error?: { code: string; message: string } | null; meta?: unknown };

export default function MyBookingsPage() {
  const { accessToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      setError('missing bearer token');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    fetch('/api/v1/bookings/me?limit=50&offset=0', {
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
  }, [accessToken]);

  const statusLabel = (s: string | undefined): string => {
    if (s === 'confirmed') return 'Επιβεβαιωμένη';
    if (s === 'pending') return 'Εκκρεμής';
    if (s === 'cancelled') return 'Ακυρωμένη';
    return s ?? '—';
  };

  const statusColor = (s: string | undefined): string => {
    if (s === 'confirmed') return 'text-emerald-700';
    if (s === 'pending') return 'text-amber-700';
    if (s === 'cancelled') return 'text-red-700';
    return 'text-neutral-700';
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 comfortaa-bold">Οι κρατήσεις μου</h1>
          <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
            Όλες οι κρατήσεις εισιτηρίων που έχετε πραγματοποιήσει.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</p>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">{error}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="grid grid-cols-[1fr_100px_100px_120px] gap-0 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600 comfortaa-regular">
              <div>Εκδήλωση</div>
              <div>Εισιτήρια</div>
              <div>Κατάσταση</div>
              <div>Σύνολο</div>
            </div>
            <ul className="divide-y divide-neutral-200">
              {bookings.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <Link
                    to={`/events/${encodeURIComponent(b.event_id)}`}
                    className="grid grid-cols-[1fr_100px_100px_120px] items-center gap-0 hover:text-[#6d28d9]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 comfortaa-regular">
                        {b.event?.title ?? b.event_id}
                      </p>
                      <p className="truncate text-xs text-neutral-500 comfortaa-regular">
                        {b.event?.venue}, {b.event?.city}
                      </p>
                    </div>
                    <div className="text-xs text-neutral-700 comfortaa-regular">
                      {b.number_of_tickets}
                    </div>
                    <div className={cn('text-xs font-medium comfortaa-regular', statusColor(b.status))}>
                      {statusLabel(b.status)}
                    </div>
                    <div className="text-sm font-medium text-[#6d28d9] comfortaa-regular">
                      {b.total_cost.toFixed(2)} €
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {bookings.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-600 comfortaa-regular">
                Δεν έχετε κρατήσεις ακόμα.{' '}
                <Link to="/events" className="text-[#6d28d9] underline">
                  Αναζητήστε εκδηλώσεις
                </Link>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}