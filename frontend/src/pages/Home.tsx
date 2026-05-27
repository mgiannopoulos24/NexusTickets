import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import Awesomplete from 'awesomplete';

import { CategoryFilterStrip } from '@/components/home/CategoryFilterStrip';
import type { HomeSectionTab } from '@/components/home/CategoryFilterStrip';
import HomeQuickNav from '@/components/home/HomeQuickNav';
import EventCard from '@/components/events/EventCard';
import { Input } from '@/components/ui/input';
import { SectionSwiper } from '@/components/ui/section-swiper';
import {
  HOME_SECTION_LABELS,
  HOME_SECTION_SUBTITLES,
  HOME_SLIDER_ORDER,
  homeViewAllHref,
  homeViewAllLabel,
  type HomeSliderKey,
} from '@/constants/homeEventSections';
import { categoryIdForSlug } from '@/lib/categorySlug';
import { cn } from '@/lib/utils';
import type { Event as EventModel } from '@/types/models';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
};

type CategoryDto = { id: string; name: string };

function sectionDomId(key: HomeSliderKey): string {
  return `home-section-${key}`;
}

/** Pixels to leave below sticky navbar when scrolling to a section. */
const SECTION_SCROLL_OFFSET_PX = 72;

const EMPTY_SECTIONS: Record<HomeSliderKey, EventModel[]> = {
  popular: [],
  recommended: [],
  new: [],
  theater: [],
  music: [],
  cinema: [],
};

export default function Home() {
  const [active, setActive] = useState<HomeSliderKey>('popular');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);
  const awesompleteRef = useRef<Awesomplete | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const suggestTimerRef = useRef<number | null>(null);

  const [eventsBySection, setEventsBySection] =
    useState<Record<HomeSliderKey, EventModel[]>>(EMPTY_SECTIONS);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const sectionTabs = useMemo<HomeSectionTab[]>(
    () =>
      HOME_SLIDER_ORDER.map((key) => ({
        key,
        id: sectionDomId(key),
        label: HOME_SECTION_LABELS[key],
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

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    setEventsError(null);

    const searchEvents = async (searchParams: string): Promise<EventModel[]> => {
      const res = await fetch(`/api/v1/events/search?${searchParams}`);
      const json = (await res.json()) as ApiEnvelope<EventModel[]>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης εκδηλώσεων');
      }
      return json.data ?? [];
    };

    const load = async () => {
      try {
        const catRes = await fetch('/api/v1/categories');
        const catJson = (await catRes.json()) as ApiEnvelope<CategoryDto[]>;
        if (!catRes.ok || catJson.error) {
          throw new Error(catJson.error?.message ?? 'Σφάλμα κατηγοριών');
        }
        const categories = catJson.data ?? [];

        const baseList = 'limit=24&offset=0';
        const [popular, recommended, rawNew] = await Promise.all([
          searchEvents(baseList),
          searchEvents(baseList),
          searchEvents('limit=48&offset=0'),
        ]);

        const newest = [...rawNew]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 24);

        const loadCat = async (slug: 'theater' | 'music' | 'cinema') => {
          const id = categoryIdForSlug(slug, categories);
          if (!id) return [];
          return searchEvents(`${baseList}&category_ids=${encodeURIComponent(id)}`);
        };

        const [theater, music, cinema] = await Promise.all([
          loadCat('theater'),
          loadCat('music'),
          loadCat('cinema'),
        ]);

        if (cancelled) return;
        setEventsBySection({
          popular,
          recommended,
          new: newest,
          theater,
          music,
          cinema,
        });
      } catch (e: unknown) {
        if (!cancelled) setEventsError(e instanceof Error ? e.message : 'Σφάλμα');
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const input = searchRef.current;
    if (!input) return;

    const a = new Awesomplete(input, {
      minChars: 2,
      maxItems: 8,
      autoFirst: true,
      replace: (text) => {
        input.value = text;
      },
    });
    awesompleteRef.current = a;

    const onSelect = (ev: Event) => {
      void ev;
    };

    input.addEventListener('awesomplete-selectcomplete', onSelect as unknown as EventListener);
    return () => {
      input.removeEventListener('awesomplete-selectcomplete', onSelect as unknown as EventListener);
      awesompleteRef.current?.destroy();
      awesompleteRef.current = null;
    };
  }, []);

  const fetchSuggestions = useCallback((raw: string) => {
    const q = raw.trim();
    if (suggestTimerRef.current !== null) {
      window.clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = null;
    }
    suggestTimerRef.current = window.setTimeout(async () => {
      suggestTimerRef.current = null;
      const a = awesompleteRef.current;
      if (!a) return;
      abortRef.current?.abort();
      if (q.length < 2) {
        a.list = [];
        a.evaluate();
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/v1/events/search?limit=8&offset=0&q=${encodeURIComponent(q)}`,
          {
            signal: controller.signal,
          },
        );
        const json = (await res.json()) as {
          data: Array<Pick<EventModel, 'id' | 'title' | 'venue' | 'city'>> | null;
          error?: { code: string; message: string } | null;
        };
        if (!res.ok || json.error) {
          a.list = [];
          a.evaluate();
          return;
        }
        const items = Array.isArray(json.data)
          ? json.data.map((ev) => ({
              label: `${ev.title} — ${ev.venue}${ev.city ? `, ${ev.city}` : ''}`,
              value: ev.title,
            }))
          : [];
        a.list = items;
        a.evaluate();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        a.list = [];
        a.evaluate();
      }
    }, 220);
  }, []);

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
      <section className="home-hero relative border-b border-neutral-100 md:h-[550px] md:overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden bg-[#d4f040] md:rounded-l-full md:block"
          style={{
            left: 'calc(max(0px, (100vw - 1400px) / 2) + 2rem + var(--hero-left-col))',
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto grid h-full max-w-[1400px] grid-cols-1 gap-10 px-4 py-10 sm:px-6 md:grid-cols-[var(--hero-left-col)_minmax(0,1fr)] md:items-stretch md:gap-0 md:px-8 md:py-0">
          <div className="flex min-h-0 w-full flex-col justify-center md:min-h-[550px]">
            <div className="w-full min-w-0 max-w-[800px]">
              <h1 className="text-balance text-3xl comfortaa-bold tracking-tight text-[#000020]">
                Η επόμενη εμπειρία σου ξεκινάει εδώ
              </h1>
              <p className="mt-4 text-lg comfortaa-regular text-neutral-500 tracking-tight">
                Κλείσε τώρα το εισιτήριό σου εύκολα, γρήγορα και με ασφάλεια.
              </p>
              <div className="mt-8">
                <label htmlFor="home-search" className="sr-only">
                  Αναζήτηση
                </label>
                <div className="relative flex items-center">
                  <Search
                    className="pointer-events-none absolute left-5 size-5 text-indigo-500"
                    aria-hidden={true}
                  />
                  <Input
                    id="home-search"
                    type="search"
                    placeholder="Αναζήτηση εκδήλωσης, χώρου ή περιοχής"
                    ref={searchRef}
                    onChange={(e) => fetchSuggestions(e.target.value)}
                    className={cn(
                      'h-14 w-full rounded-full border-0 bg-white pl-14 pr-6 text-[16px] max-[600px]:text-[14px]',
                      'comfortaa-regular text-neutral-900 ring-0 placeholder:text-neutral-500',
                      'max-[600px]:placeholder:text-[14px]',
                      'transition-shadow duration-300 ease-out motion-reduce:transition-none',
                      'shadow-[0_4px_14px_-4px_rgba(15,23,42,0.12),inset_0_0_0_1px_rgb(229_231_235)]',
                      'hover:shadow-[0_4px_14px_-4px_rgba(15,23,42,0.12),inset_0_0_0_1px_rgb(212_212_216)]',
                      'focus-visible:shadow-[0_4px_14px_-4px_rgba(15,23,42,0.14),inset_0_0_0_2px_#6d28d9]',
                      'focus-visible:ring-0 focus-visible:outline-none',
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative min-h-[280px] min-w-0 md:min-h-[550px]">
            <div
              className="absolute inset-0 rounded-t-[2.5rem] bg-[#d4f040] md:hidden"
              aria-hidden
            />
            <div className="relative z-10 flex h-full min-h-[280px] items-center justify-center p-6 md:min-h-[550px] md:p-8">
              <div className="h-full w-full max-w-lg rounded-2xl border border-neutral-200/80 bg-white/95 p-6 text-neutral-900 shadow-sm backdrop-blur-sm md:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 comfortaa-regular">
                  Προτεινόμενο
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight comfortaa-bold text-[#000020]">
                  Θεατρική σεζόν
                </p>
                <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
                  Ανακάλυψε παραστάσεις κοντά σου.
                </p>
                <Link
                  to="/events/category/theater"
                  className="mt-5 inline-flex w-fit rounded-full bg-[#6d28d9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 comfortaa-regular"
                >
                  Δες εκδηλώσεις θεάτρου
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeQuickNav />

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
              className={cn('scroll-mt-[72px]', idx > 0 && 'mt-12')}
              tabIndex={-1}
            >
              <SectionSwiper
                title={HOME_SECTION_LABELS[key]}
                subtitle={HOME_SECTION_SUBTITLES[key]}
                viewAllHref={homeViewAllHref(key)}
                viewAllLabel={homeViewAllLabel(key)}
              >
                {eventsLoading ? (
                  <div className="text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</div>
                ) : eventsError ? (
                  <div className="text-sm text-[var(--nexus-red)] comfortaa-regular">
                    {eventsError}
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-sm text-neutral-600 comfortaa-regular">
                    {key === 'theater' || key === 'music' || key === 'cinema'
                      ? 'Δεν υπάρχουν εκδηλώσεις σε αυτή την κατηγορία.'
                      : 'Δεν υπάρχουν εκδηλώσεις ακόμα.'}
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
    </>
  );
}
