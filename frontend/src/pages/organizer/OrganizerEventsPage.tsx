import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import { useAuth } from '@/hooks/useAuth';
import type { Event } from '@/types/models';
import { cn } from '@/lib/utils';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

export default function OrganizerEventsPage() {
  const { accessToken } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (!accessToken) {
      setError('missing bearer token');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void fetch('/api/v1/events/organizer/me?limit=50&offset=0', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (res) => {
        const json = (await res.json()) as ApiEnvelope<Event[]>;
        if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης');
        if (!cancelled) setEvents(json.data ?? []);
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

  return (
    <OrganizerLayout>
      <div className="bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">Οι εκδηλώσεις μου</h1>
            <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
              Δημιουργία, επεξεργασία και δημοσίευση των εκδηλώσεών σας.
            </p>
          </div>
          <Link
            to="/organizer/events/new"
            className="inline-flex shrink-0 items-center justify-center rounded-none border-2 border-[#6d28d9] bg-[#6d28d9] px-4 py-2 text-sm text-white hover:bg-[#5b21b6] comfortaa-regular"
          >
            Νέα εκδήλωση
          </Link>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</p>
        ) : error ? (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">
            {error}
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200">
            <div className="grid grid-cols-[minmax(0,1fr)_140px_220px] gap-0 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600 comfortaa-regular">
              <div>Τίτλος</div>
              <div>Κατάσταση</div>
              <div>Ημερομηνίες</div>
            </div>
            <ul className="divide-y divide-neutral-200">
              {events.map((ev) => (
                <li key={ev.id} className="px-4 py-3">
                  <Link
                    to={`/organizer/events/${encodeURIComponent(ev.id)}/edit`}
                    className={cn('grid grid-cols-[minmax(0,1fr)_140px_220px] items-center gap-0')}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 comfortaa-regular">
                        {ev.title}
                      </p>
                      <p className="truncate text-xs text-neutral-500 comfortaa-regular">
                        {ev.venue} • {ev.city}
                      </p>
                    </div>
                    <div className="text-xs text-neutral-700 comfortaa-regular">{ev.status}</div>
                    <div className="text-xs text-neutral-700 comfortaa-regular">
                      {new Date(ev.start_at).toLocaleDateString('el-GR')} –{' '}
                      {new Date(ev.end_at).toLocaleDateString('el-GR')}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {events.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-600 comfortaa-regular">
                Δεν υπάρχουν εκδηλώσεις ακόμα.{' '}
                <Link to="/organizer/events/new" className="text-[#6d28d9] underline">
                  Δημιουργήστε την πρώτη σας
                </Link>
                .
              </p>
            ) : null}
          </div>
        )}
      </div>
    </OrganizerLayout>
  );
}
