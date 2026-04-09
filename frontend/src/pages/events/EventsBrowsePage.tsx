import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetEventsQuery } from '@/app/eventsApi';
import { setFilter } from '@/app/eventsSlice';
import EventCard from '@/components/events/EventCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useLang } from '@/contexts/LangContext';

export default function EventsBrowsePage() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();
  const { currentPage, pageSize } = useAppSelector((state) => state.events);
  const { t } = useLang();

  useEffect(() => {
    if (slug) {
      dispatch(setFilter({ key: 'category', value: slug }));
    }
  }, [slug, dispatch]);

  const { data, isLoading } = useGetEventsQuery({
    category: slug,
    page: currentPage,
    size: pageSize,
  });

  const eventsResponse = data?.data;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          to="/events"
          className="text-sm text-muted-foreground hover:underline comfortaa-regular"
        >
          ← {t('nav.events')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-neutral-950 comfortaa-bold capitalize">
          {slug}
        </h1>
      </div>

      {isLoading ? (
        <LoadingSpinner className="mt-10" />
      ) : eventsResponse && eventsResponse.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {eventsResponse.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Καμία εκδήλωση"
          description={`Δεν υπάρχουν δημοσιευμένες εκδηλώσεις στην κατηγορία ${slug}.`}
          className="mt-10"
        />
      )}
    </div>
  );
}
