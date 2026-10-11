import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CategoryFilterStrip, SECTION_TABS_HEIGHT_PX } from '@/components/home/CategoryFilterStrip';
import { HeroSearch } from '@/components/home/HeroSearch';
import { HeroSlider } from '@/components/home/HeroSlider';
import { heroBandColor } from '@/components/home/heroBand';
import type { HomeSectionTab } from '@/components/home/CategoryFilterStrip';
import HomeQuickNav from '@/components/home/HomeQuickNav';
import EventCard from '@/components/events/EventCard';
import { SectionSwiper } from '@/components/ui/section-swiper';
import {
  homeSectionLabel,
  homeSectionSubtitle,
  HOME_SLIDER_ORDER,
  homeViewAllHref,
  homeViewAllLabel,
  type CategoryBrowseSlug,
  type HomeSliderKey,
} from '@/constants/homeEventSections';
import { apiErrorMessage } from '@/app/apiEnvelope';
import {
  useGetRecommendedQuery,
  useListCategoriesQuery,
  useSearchEventsQuery,
} from '@/app/eventsApi';
import { categoryIdForSlug } from '@/lib/categorySlug';
import { cn } from '@/lib/utils';
import type { Event as EventModel } from '@/types/models';
import { useLang } from '@/contexts/langContextCore';

function sectionDomId(key: HomeSliderKey): string {
  return `home-section-${key}`;
}

/** Pixels to leave below sticky navbar when scrolling to a section. */
// Navbar (64px) + the sticky tab row: what must stay clear above a section.
const SECTION_SCROLL_OFFSET_PX = 64 + SECTION_TABS_HEIGHT_PX;

const EMPTY_SECTIONS: Record<HomeSliderKey, EventModel[]> = {
  popular: [],
  recommended: [],
  new: [],
  theater: [],
  music: [],
  cinema: [],
};

export default function Home() {
  const { t } = useLang();
  const [active, setActive] = useState<HomeSliderKey>('popular');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const sectionTabs = useMemo<HomeSectionTab[]>(
    () =>
      HOME_SLIDER_ORDER.map((key) => ({
        key,
        id: sectionDomId(key),
        label: homeSectionLabel(key),
      })),
    [],
  );

  useEffect(() => {
    const onScroll = () => {
      const anchor = SECTION_SCROLL_OFFSET_PX + 24;
      let best: { key: HomeSliderKey; dist: number } | null = null;
      for (const s of sectionTabs) {
        const el = sectionRefs.current[s.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top - anchor);
        if (!best || dist < best.dist) {
          best = { key: s.key, dist };
        }
      }
      if (best && best.key !== active) setActive(best.key);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [active, sectionTabs]);

  // Each home rail is its own query. The category rails wait for the taxonomy
  // so they can turn a slug into the id the API filters on.
  const LIST = { limit: 24, offset: 0 } as const;

  const { data: categories } = useListCategoriesQuery();

  const popularQ = useSearchEventsQuery(LIST);
  const recommendedQ = useGetRecommendedQuery(24);
  const newestQ = useSearchEventsQuery({ limit: 48, offset: 0 });

  const catId = useCallback(
    (slug: CategoryBrowseSlug) => (categories ? categoryIdForSlug(slug, categories) : null),
    [categories],
  );

  const theaterId = catId('theater');
  const musicId = catId('music');
  const cinemaId = catId('cinema');

  const theaterQ = useSearchEventsQuery(
    { ...LIST, category_ids: theaterId ? [theaterId] : undefined },
    { skip: !theaterId },
  );
  const musicQ = useSearchEventsQuery(
    { ...LIST, category_ids: musicId ? [musicId] : undefined },
    { skip: !musicId },
  );
  const cinemaQ = useSearchEventsQuery(
    { ...LIST, category_ids: cinemaId ? [cinemaId] : undefined },
    { skip: !cinemaId },
  );

  const eventsLoading =
    popularQ.isLoading || recommendedQ.isLoading || newestQ.isLoading || !categories;

  // Only a failure of the main rail is worth showing: the category rails simply
  // render empty if their query fails.
  const eventsError = popularQ.error ? apiErrorMessage(popularQ.error, t('home.loadError')) : null;

  const eventsBySection = useMemo<Record<HomeSliderKey, EventModel[]>>(() => {
    const popular = popularQ.data?.events ?? [];

    // Newest is the same catalogue re-sorted by creation time.
    const newest = [...(newestQ.data?.events ?? [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 24);

    return {
      ...EMPTY_SECTIONS,
      popular,
      // Req 13: personalised when signed in, popular otherwise. If the
      // recommender is unavailable the rail falls back to the popular list
      // rather than disappearing.
      recommended: recommendedQ.data?.length ? recommendedQ.data : popular,
      new: newest,
      theater: theaterQ.data?.events ?? [],
      music: musicQ.data?.events ?? [],
      cinema: cinemaQ.data?.events ?? [],
    };
  }, [popularQ.data, recommendedQ.data, newestQ.data, theaterQ.data, musicQ.data, cinemaQ.data]);

  // The hero shows the most popular events, posters first (like a billboard).
  const heroEvents = useMemo(() => {
    const pool = eventsBySection.popular.length ? eventsBySection.popular : eventsBySection.new;
    return [...pool]
      .sort((a, b) => Number(Boolean(b.featured_image_url)) - Number(Boolean(a.featured_image_url)))
      .slice(0, 6);
  }, [eventsBySection]);
  const [heroIndex, setHeroIndex] = useState(0);

  const scrollToSection = (key: HomeSliderKey) => {
    const id = sectionDomId(key);
    const el = sectionRefs.current[id];
    if (!el) return;
    setActive(key);
    const top = el.getBoundingClientRect().top + window.scrollY - SECTION_SCROLL_OFFSET_PX;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  return (
    <>
      {/* Hero, after more.com: text + pill search on the left; on the right a
          half-pill colour band (cycling per slide) with a cross-fading poster
          slider straddling its edge. Below md the band goes and the slider
          stacks under the text. Clipped sideways only, so the search results
          can drop below the hero. Stacked above the sticky category strip
          (z-30) so those results are not hidden under it, and below the
          navbar (z-50). */}
      <section className="relative z-40 overflow-x-clip border-b border-neutral-100 bg-white md:h-[min(80vh,550px)]">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44vw] rounded-l-full transition-colors duration-1000 md:block"
          style={{ backgroundColor: heroBandColor(heroIndex) }}
          aria-hidden
        />
        <div className="relative mx-auto flex h-full max-w-[1400px] flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-center md:gap-0 md:py-0 lg:px-8">
          <div className="min-w-0 text-center md:w-[420px] md:shrink-0 md:text-left">
            <h1 className="text-balance text-3xl leading-tight comfortaa-bold tracking-tight text-[#000020] sm:text-4xl">
              {t('hero.title')}
            </h1>
            <p className="mt-3 hidden text-lg comfortaa-regular text-neutral-500 sm:block">
              {t('hero.lead')}
            </p>
            <div className="mt-8">
              <HeroSearch />
            </div>
          </div>

          {/* Like more.com: the slider is anchored to the right edge, as wide
              as what is left after the 520px text column, capped at the
              poster's own 816px. */}
          <div className="relative z-10 min-w-0 md:absolute md:inset-y-0 md:right-0 md:flex md:w-[calc(100%-520px)] md:max-w-[816px] md:items-center">
            {heroEvents.length > 0 ? (
              <HeroSlider events={heroEvents} onIndexChange={setHeroIndex} />
            ) : (
              <div
                className="aspect-[816/465] w-full animate-pulse rounded-md bg-neutral-200"
                aria-hidden
              />
            )}
          </div>
        </div>
      </section>

      <HomeQuickNav />

      {/* One wrapper for the tab row and the sections: the sticky row stays
          pinned only while this block scrolls, then releases before the footer. */}
      <div>
        <CategoryFilterStrip
          sectionTabs={sectionTabs}
          activeSection={active}
          onSectionTabClick={scrollToSection}
        />

        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {HOME_SLIDER_ORDER.map((key, idx) => {
            const sId = sectionDomId(key);
            const events = eventsBySection[key];
            return (
              <div
                key={sId}
                id={sId}
                ref={(el) => {
                  sectionRefs.current[sId] = el;
                }}
                className={cn('scroll-mt-[130px]', idx > 0 && 'mt-12')}
                tabIndex={-1}
              >
                <SectionSwiper
                  title={homeSectionLabel(key)}
                  subtitle={homeSectionSubtitle(key)}
                  viewAllHref={homeViewAllHref(key)}
                  viewAllLabel={homeViewAllLabel(key)}
                >
                  {eventsLoading ? (
                    <div className="text-sm text-neutral-600 comfortaa-regular">
                      {t('common.loading')}
                    </div>
                  ) : eventsError ? (
                    <div className="text-sm text-[var(--nexus-red)] comfortaa-regular">
                      {eventsError}
                    </div>
                  ) : events.length === 0 ? (
                    <div className="text-sm text-neutral-600 comfortaa-regular">
                      {key === 'theater' || key === 'music' || key === 'cinema'
                        ? t('home.noEventsInCategory')
                        : t('home.noEventsYet')}
                    </div>
                  ) : (
                    events.map((ev) => (
                      <div key={`${sId}-${ev.id}`} className="snap-start">
                        <EventCard event={ev} />
                      </div>
                    ))
                  )}
                </SectionSwiper>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
