import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';

import { useListCategoriesQuery, useSearchEventsQuery } from '@/app/eventsApi';
import EventCard from '@/components/events/EventCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { useLang } from '@/contexts/langContextCore';
import { categoryIdForSlug } from '@/lib/categorySlug';
import type { CategoryBrowseSlug } from '@/constants/homeEventSections';

const PAGE_SIZE = 24;

export default function EventsBrowsePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLang();

  const { data: categories } = useListCategoriesQuery();

  // The URL carries a stable slug ("music"); the API filters by category id, so
  // resolve one to the other once the taxonomy has loaded.
  const categoryId = useMemo(() => {
    if (!slug || !categories) return null;
    return categoryIdForSlug(slug as CategoryBrowseSlug, categories);
  }, [slug, categories]);

  const displayName = useMemo(() => {
    if (!categoryId || !categories) return slug ?? '';
    return categories.find((c) => c.id === categoryId)?.name ?? slug ?? '';
  }, [categoryId, categories, slug]);

  const { data, isLoading, error, refetch } = useSearchEventsQuery(
    { category_ids: categoryId ? [categoryId] : undefined, limit: PAGE_SIZE, offset: 0 },
    { skip: !categoryId },
  );

  const events = data?.events ?? [];
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          to="/events"
          className="comfortaa-regular text-sm text-muted-foreground hover:underline"
        >
          ← {t('nav.events')}
        </Link>
        <h1 className="comfortaa-bold mt-2 text-3xl font-bold capitalize text-neutral-950">
          {displayName}
        </h1>
      </div>

      {error ? (
        <ErrorMessage
          message={t('browse.loadError')}
          onRetry={() => void refetch()}
          className="mt-10"
        />
      ) : isLoading || !categories ? (
        <LoadingSpinner className="mt-10" />
      ) : !categoryId ? (
        <EmptyState
          title={t('browse.unknownCategory')}
          description={t('browse.unknownCategoryBody', { slug: slug ?? '' })}
          className="mt-10"
        />
      ) : events.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t('browse.emptyTitle')}
          description={t('browse.emptyBody', { name: displayName })}
          className="mt-10"
        />
      )}
    </div>
  );
}
