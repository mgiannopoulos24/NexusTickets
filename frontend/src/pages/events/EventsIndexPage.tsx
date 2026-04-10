import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetEventsQuery, useGetRecommendedQuery } from '@/app/eventsApi';
import { setFilter, setPage } from '@/app/eventsSlice';
import EventCard from '@/components/events/EventCard';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Filter } from 'lucide-react';
import { useLang } from '@/contexts/LangContext';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { EmptyState } from '@/components/shared/EmptyState';
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

  // Sync Redux state with URL on mount
  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    if (Object.keys(params).length > 0) {
      Object.entries(params).forEach(([key, value]) => {
        dispatch(setFilter({ key: key as any, value }));
      });
      if (params.page) dispatch(setPage(Number(params.page)));
    }
  }, [searchParams, dispatch]);

  // Sync URL with Redux state
  useEffect(() => {
    const params = { ...filters, page: currentPage, size: pageSize };
    const cleanParams = Object.fromEntries(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    );
    setSearchParams(cleanParams);
  }, [filters, currentPage, pageSize, setSearchParams]);

  const { data, isLoading, isFetching } = useGetEventsQuery({
    ...filters,
    page: currentPage,
    size: pageSize,
  });

  const { data: recData, isLoading: recLoading } = useGetRecommendedQuery();

  const eventsResponse = data?.data;
  const meta = data?.meta;
  const recommendedEvents = recData?.data;

  return (
    <div className="container mx-auto px-4 py-8 flex gap-8">
      {/* Desktop Filter Sidebar */}
      <aside className="w-72 shrink-0 hidden lg:block">
        <EventsFilters />
      </aside>

      {/* Main Content */}
      <main className="flex-1 space-y-10">
        {/* Recommended Section */}
        {isAuthenticated && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold comfortaa-bold">Προτεινόμενες Εκδηλώσεις</h2>
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
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold comfortaa-bold">{t('nav.events')}</h1>
            {isFetching && (
              <Badge variant="outline" className="animate-pulse">
                Φόρτωση...
              </Badge>
            )}
          </div>

          {isLoading ? (
            <SkeletonList rows={pageSize} />
          ) : eventsResponse && eventsResponse.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {eventsResponse.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>

              {meta && meta.total_pages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => dispatch(setPage(Math.max(1, currentPage - 1)))}
                      />
                    </PaginationItem>

                    <PaginationItem>
                      <PaginationLink
                        isActive={currentPage === 1}
                        onClick={() => dispatch(setPage(1))}
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>

                    {meta.total_pages > 3 && currentPage > 3 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}

                    {meta.total_pages > 1 && (
                      <PaginationItem>
                        <PaginationLink
                          isActive={currentPage === meta.total_pages}
                          onClick={() => dispatch(setPage(meta.total_pages))}
                        >
                          {meta.total_pages}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          dispatch(setPage(Math.min(meta.total_pages, currentPage + 1)))
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          ) : (
            <EmptyState
              title={t('labels.events') || 'Εκδηλώσεις'}
              description={t('emptyStates.noEvents')}
            />
          )}
        </div>
      </main>

      {/* Mobile Filter FAB */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 lg:hidden z-50">
        <Dialog open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
          <DialogTrigger asChild>
            <Button
              className="rounded-full px-6 py-6 shadow-lg bg-primary text-primary-foreground flex items-center gap-2"
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
