import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Trash2Icon, FileTextIcon } from 'lucide-react';

import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import { useAuth } from '@/hooks/useAuth';
import type { Event } from '@/types/models';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

  const canDelete = (ev: Event): boolean => {
  return ev.status === 'draft' || (ev.status === 'published' && (ev.total_bookings ?? 0) === 0);
};

const statusLabel = (s: string | undefined): string => {
  if (s === 'draft') return 'Πρόχειρο';
  if (s === 'published') return 'Δημοσιευμένο';
  if (s === 'cancelled') return 'Ακυρωμένο';
  return s ?? '—';
};

const onDelete = async (ev: Event, accessToken: string) => {
  if (!window.confirm(`Διαγραφή "${ev.title}"; Είστε σίγουροι;`)) return;
  try {
    const res = await fetch(`/api/v1/events/organizer/${encodeURIComponent(ev.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as ApiEnvelope<{ id: string }>;
    if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Αποτυχία διαγραφής');
    toast.success('Η εκδήλωση διαγράφηκε');
    window.location.reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Σφάλμα');
  }
};

return (
    <OrganizerLayout>
      <div className="bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">
              Οι εκδηλώσεις μου
            </h1>
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
            <div className="grid grid-cols-[minmax(0,1fr)_140px_100px_220px_100px] gap-0 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600 comfortaa-regular">
              <div>Τίτλος</div>
              <div>Κατάσταση</div>
              <div>Κρατήσεις</div>
              <div>Ημερομηνίες</div>
              <div></div>
            </div>
            <ul className="divide-y divide-neutral-200">
              {events.map((ev) => (
                <li key={ev.id} className="px-4 py-3">
                  <div
                    className={cn('grid grid-cols-[minmax(0,1fr)_140px_100px_220px_100px] items-center gap-0')}
                  >
                    <Link
                      to={`/organizer/events/${encodeURIComponent(ev.id)}/edit`}
                      className="min-w-0"
                    >
                      <p className="truncate text-sm font-medium text-neutral-900 comfortaa-regular hover:text-[#6d28d9]">
                        {ev.title}
                      </p>
                      <p className="truncate text-xs text-neutral-500 comfortaa-regular">
                        {ev.venue} • {ev.city}
                      </p>
                    </Link>
                    <div className="text-xs text-neutral-700 comfortaa-regular">
                      {statusLabel(ev.status)}
                    </div>
                    <div className="text-xs text-neutral-700 comfortaa-regular">
                      {(ev.total_bookings ?? 0) > 0 ? (
                        <Link
                          to={`/organizer/events/${encodeURIComponent(ev.id)}/bookings`}
                          className="text-[#6d28d9] underline hover:no-underline"
                        >
                          {ev.total_bookings}
                        </Link>
                      ) : (
                        '0'
                      )}
                    </div>
                    <div className="text-xs text-neutral-700 comfortaa-regular whitespace-nowrap">
                      {new Date(ev.start_at).toLocaleDateString('el-GR')} –{' '}
                      {new Date(ev.end_at).toLocaleDateString('el-GR')}
                    </div>
                    <div className="flex justify-end gap-2">
                      {accessToken && (ev.total_bookings ?? 0) > 0 && (
                        <Link
                          to={`/organizer/events/${encodeURIComponent(ev.id)}/bookings`}
                          title="Προβολή κρατήσεων"
                        >
                          <Button variant="ghost" size="icon" className="size-8">
                            <FileTextIcon className="size-4" />
                          </Button>
                        </Link>
                      )}
                      {canDelete(ev) && accessToken && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-neutral-500 hover:text-[var(--nexus-red)]"
                          title="Διαγραφή"
                          onClick={() => onDelete(ev, accessToken)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
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
