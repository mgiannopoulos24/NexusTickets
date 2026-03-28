import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EventCard } from '@/components/events/EventCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Event as EventModel } from '@/types/models';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
};

export default function EventsIndexPage() {
  const [searchParams] = useSearchParams();
  const city = searchParams.get('city')?.trim() ?? '';
  const special = searchParams.get('special')?.trim() ?? '';

  const [events, setEvents] = useState<EventModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => `${city}|${special}`, [city, special]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: '48', offset: '0' });
    if (city) params.set('city', city);

    void fetch(`/api/v1/events/search?${params.toString()}`)
      .then(async (res) => {
        const json = (await res.json()) as ApiEnvelope<EventModel[]>;
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης');
        }
        let list = json.data ?? [];
        if (special === 'offers' && list.length > 0) {
          const minPrice = (ev: EventModel) => {
            if (!ev.ticket_types.length) return Number.POSITIVE_INFINITY;
            return Math.min(...ev.ticket_types.map((t) => t.price));
          };
          list = [...list].sort((a, b) => minPrice(a) - minPrice(b));
        }
        if (!cancelled) setEvents(list);
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
  }, [queryKey, city, special]);

  const heading = useMemo(() => {
    if (special === 'offers') return 'Προσφορές';
    if (city) return city;
    return 'Εκδηλώσεις';
  }, [special, city]);

  const subheading = useMemo(() => {
    if (special === 'offers') {
      return 'Εκδηλώσεις με χαμηλότερες τιμές εισιτηρίου (ταξινόμηση κατά τιμή).';
    }
    if (city) {
      return `Αποτελέσματα για πόλη: ${city}.`;
    }
    return 'Όλες οι δημοσιευμένες εκδηλώσεις.';
  }, [special, city]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">{heading}</h1>
      <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">{subheading}</p>

      {loading ? (
        <LoadingSpinner className="mt-10" />
      ) : error ? (
        <p className="mt-8 text-sm text-[var(--nexus-red)] comfortaa-regular">{error}</p>
      ) : events.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="Δεν υπάρχουν εκδηλώσεις"
          description="Δεν βρέθηκαν δημοσιευμένες εκδηλώσεις με τα τρέχοντα φίλτρα."
        />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((ev) => (
            <li key={ev.id}>
              <EventCard event={ev} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
