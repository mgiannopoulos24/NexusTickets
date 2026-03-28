import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EventCard } from '@/components/events/EventCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { CategoryBrowseSlug } from '@/constants/homeEventSections';
import { categoryIdForSlug } from '@/lib/categorySlug';
import type { Event as EventModel } from '@/types/models';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
};

type CategoryDto = { id: string; name: string };

const SLUG_SET = new Set<string>([
  'theater',
  'music',
  'cinema',
  'sports',
  'child',
  'museums',
  'dance',
]);

function titleForSlug(slug: string): string {
  switch (slug) {
    case 'theater':
      return 'Θέατρο';
    case 'music':
      return 'Μουσική';
    case 'cinema':
      return 'Σινεμά';
    case 'sports':
      return 'Αθλητικά';
    case 'child':
      return 'Παιδικά';
    case 'museums':
      return 'Μουσεία';
    case 'dance':
      return 'Χορός';
    default:
      return 'Κατηγορία';
  }
}

export default function EventsBrowsePage() {
  const { slug: rawSlug } = useParams();
  const slug = rawSlug ?? '';
  const validSlug = SLUG_SET.has(slug) ? (slug as CategoryBrowseSlug) : null;

  const [events, setEvents] = useState<EventModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingCategory, setMissingCategory] = useState(false);

  useEffect(() => {
    if (!validSlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setMissingCategory(false);

      try {
        const catRes = await fetch('/api/v1/categories');
        const catJson = (await catRes.json()) as ApiEnvelope<CategoryDto[]>;
        if (!catRes.ok || catJson.error) {
          throw new Error(catJson.error?.message ?? 'Σφάλμα κατηγοριών');
        }
        const cats = catJson.data ?? [];
        if (cancelled) return;

        const id = categoryIdForSlug(validSlug, cats);
        if (!id) {
          setMissingCategory(true);
          setEvents([]);
          return;
        }

        const params = new URLSearchParams({
          limit: '48',
          offset: '0',
          category_ids: id,
        });
        const evRes = await fetch(`/api/v1/events/search?${params.toString()}`);
        const evJson = (await evRes.json()) as ApiEnvelope<EventModel[]>;
        if (!evRes.ok || evJson.error) {
          throw new Error(evJson.error?.message ?? 'Σφάλμα φόρτωσης εκδηλώσεων');
        }
        if (!cancelled) setEvents(evJson.data ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Σφάλμα');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [validSlug]);

  if (!validSlug) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--nexus-red)] comfortaa-regular">Άκυρη κατηγορία.</p>
        <Link
          to="/events"
          className="mt-4 inline-block text-sm text-[#6d28d9] hover:underline comfortaa-regular"
        >
          ← Επιστροφή σε όλες τις εκδηλώσεις
        </Link>
      </div>
    );
  }

  const pageTitle = titleForSlug(slug);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs text-neutral-500 comfortaa-regular">
        <Link to="/" className="hover:underline">
          Αρχική
        </Link>{' '}
        /{' '}
        <Link to="/events" className="hover:underline">
          Εκδηλώσεις
        </Link>{' '}
        / {pageTitle}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-neutral-950 comfortaa-bold">{pageTitle}</h1>
      <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
        Εκδηλώσεις με την επιλεγμένη κατηγορία (από διαχειριστή).
      </p>

      {loading ? (
        <LoadingSpinner className="mt-10" />
      ) : error ? (
        <p className="mt-8 text-sm text-[var(--nexus-red)] comfortaa-regular">{error}</p>
      ) : missingCategory ? (
        <EmptyState
          className="mt-10"
          title="Δεν βρέθηκε η κατηγορία"
          description="Η κατηγορία δεν υπάρχει στη βάση ή το όνομά της δεν ταιριάζει (π.χ. Θέατρο, Μουσική, Σινεμά). Ο διαχειριστής μπορεί να προσθέσει κατηγορίες και να τις συνδέσει με εκδηλώσεις."
        />
      ) : events.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="Καμία εκδήλωση"
          description="Δεν υπάρχουν δημοσιευμένες εκδηλώσεις σε αυτή την κατηγορία ακόμα."
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
