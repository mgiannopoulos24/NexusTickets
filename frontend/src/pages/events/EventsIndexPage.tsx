import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetRecommendedQuery, useSearchEventsQuery } from '@/app/eventsApi';
import { setFilter, setPage } from '@/app/eventsSlice';
import EventCard from '@/components/events/EventCard';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Filter } from 'lucide-react';
import { useLang } from '@/contexts/langContext';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EventsFilters } from '@/components/events/EventsFilters';
import { Button } from '@/components/ui/button';

export default function EventsIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { filters, currentPage, pageSize } = useAppSelector((state) => state.events);
  const { isAuthenticated } = useAuth();
  const { t } = useLang();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Hydrate the filter state from the URL once, so a shared search link
  // reproduces the same results.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const get = (k: string) => searchParams.get(k) ?? undefined;
    const num = (k: string) => {
      const raw = searchParams.get(k);
      if (raw === null) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };

    dispatch(setFilter({ key: 'q', value: get('q') }));
    dispatch(setFilter({ key: 'title', value: get('title') }));
    dispatch(setFilter({ key: 'city', value: get('city') }));
    dispatch(setFilter({ key: 'start_at', value: get('start_at') }));
    dispatch(setFilter({ key: 'end_at', value: get('end_at') }));
    dispatch(setFilter({ key: 'min_price', value: num('min_price') }));
    dispatch(setFilter({ key: 'max_price', value: num('max_price') }));

    const cats = get('category_ids');
    dispatch(setFilter({ key: 'category_ids', value: cats ? cats.split(',') : undefined }));

    const page = num('page');
    if (page && page > 0) dispatch(setPage(page));
  }, [searchParams, dispatch]);

  // Mirror the filter state back into the URL.
  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.q) next.set('q', filters.q);
    if (filters.title) next.set('title', filters.title);
    if (filters.city) next.set('city', filters.city);
    if (filters.start_at) next.set('start_at', filters.start_at);
    if (filters.end_at) next.set('end_at', filters.end_at);
    if (filters.min_price !== undefined) next.set('min_price', String(filters.min_price));
    if (filters.max_price !== undefined) next.set('max_price', String(filters.max_price));
    if (filters.category_ids?.length) next.set('category_ids', filters.category_ids.join(','));
    if (currentPage > 1) next.set('page', String(currentPage));
    setSearchParams(next, { replace: true });
  }, [filters, currentPage, setSearchParams]);

  const { data, isLoading, isFetching, error, refetch } = useSearchEventsQuery({
    ...filters,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  });

  // Recommendations are only rendered for a signed-in user, so don't ask for
  // them at all while browsing anonymously.
  const { data: recommendedEvents, isLoading: recLoading } = useGetRecommendedQuery(undefined, {
    skip: !isAuthenticated,
  });

  const events = data?.events ?? [];
  const hasMore = data?.meta.has_more ?? false;

  // While the user is filtering, the recommendation strip sits above the
  // results showing events that ignore the criteria — which reads as "the
  // filters did nothing". Hide it until the criteria are cleared.
  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
  );

  return (
    <div className="container mx-auto px-4 py-8 flex gap-8">
      {/* Desktop Filter Sidebar */}
      <aside className="w-72 shrink-0 hidden lg:block">
        <EventsFilters />
      </aside>

      {/* Main Content */}
      <main className="flex-1 space-y-10">
        {/* Recommended Section */}
        {isAuthenticated && !hasActiveFilters && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold comfortaa-bold">{t('eventsIndex.recommended')}</h2>
            </div>
            {recLoading ? (
              <SkeletonList rows={3} />
            ) : recommendedEvents && recommendedEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {recommendedEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : null}
          </section>
        )}

        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-3xl font-bold comfortaa-bold">{t('nav.events')}</h1>
              {/* Without a count, a filter that still fills the page looks like
                  it did nothing. */}
              {!error && !isLoading && (
                <p
                  data-testid="results-summary"
                  className="comfortaa-regular text-sm text-muted-foreground"
                >
                  {events.length === 0
                    ? t('eventsIndex.none')
                    : t(events.length === 1 ? 'eventsIndex.countOne' : 'eventsIndex.countMany', {
                        count: events.length,
                        more: hasMore ? '+' : '',
                      })}
                  {hasActiveFilters ? t('eventsIndex.withFilters') : ''}
                </p>
              )}
            </div>
            {isFetching && (
              <Badge variant="outline" className="animate-pulse">
                {t('eventsIndex.loading')}
              </Badge>
            )}
          </div>

          {error ? (
            <ErrorMessage message={t('eventsIndex.loadError')} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <SkeletonList rows={pageSize} />
          ) : events.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>

              {/* The API reports whether another page exists rather than a
                  total count, so paging is previous/next. */}
              {(currentPage > 1 || hasMore) && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : undefined}
                        onClick={() => dispatch(setPage(Math.max(1, currentPage - 1)))}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink isActive>{currentPage}</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        aria-disabled={!hasMore}
                        className={!hasMore ? 'pointer-events-none opacity-50' : undefined}
                        onClick={() => hasMore && dispatch(setPage(currentPage + 1))}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          ) : (
            <EmptyState
              title={t('eventsIndex.emptyTitle')}
              description={t('eventsIndex.emptyBody')}
            />
          )}
        </div>
      </main>

      {/* Mobile Filter FAB */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 lg:hidden z-50">
        <Dialog open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
          <DialogTrigger asChild>
            <Button
              className="rounded-xl px-6 shadow-lg bg-primary text-primary-foreground flex items-center gap-2"
              size="lg"
            >
              <Filter className="size-5" />
              <span>{t('actions.filter')}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90vw] max-w-[90vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('actions.filter')}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <EventsFilters />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
