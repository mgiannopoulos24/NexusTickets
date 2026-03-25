import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SectionSwiper } from '@/components/ui/section-swiper';
import { EventCard } from '@/components/events/EventCard';
import type { Event as EventModel } from '@/types/models';
import { useDragScroll } from '@/hooks/useDragScroll';
import Awesomplete from 'awesomplete';

const SECTIONS = [
  { label: 'Δημοφιλή' },
  { label: 'Προτεινόμενα' },
  { label: 'Νέα' },
  { label: 'Κατηγορίες' },
  { label: 'Θέατρο' },
  { label: 'Μουσική' },
  { label: 'Σινεμά' },
] as const;

type HomeSectionKey = (typeof SECTIONS)[number]['label'];

function sectionId(label: string): string {
  return `home-section-${label
    .toLocaleLowerCase('el-GR')
    .replaceAll(' ', '-')
    .replaceAll('ά', 'α')
    .replaceAll('έ', 'ε')
    .replaceAll('ή', 'η')
    .replaceAll('ί', 'ι')
    .replaceAll('ό', 'ο')
    .replaceAll('ύ', 'υ')
    .replaceAll('ώ', 'ω')}`;
}

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

export default function Home() {
  const [active, setActive] = useState<HomeSectionKey>('Δημοφιλή');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabsDrag = useDragScroll<HTMLDivElement>();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const awesompleteRef = useRef<Awesomplete | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [events, setEvents] = useState<EventModel[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const sections = useMemo(() => {
    return SECTIONS.map((s) => ({
      label: s.label,
      id: sectionId(s.label),
    }));
  }, []);

  useEffect(() => {
    const onScroll = () => {
      // Find the closest section to top.
      const top = 88; // navbar + breathing room
      let best: { label: HomeSectionKey; dist: number } | null = null;
      for (const s of sections) {
        const el = sectionRefs.current[s.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top - top);
        if (!best || dist < best.dist) {
          best = { label: s.label, dist };
        }
      }
      if (best && best.label !== active) setActive(best.label);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [active, sections]);

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    setEventsError(null);

    void fetch('/api/v1/events?limit=50&offset=0')
      .then(async (res) => {
        const json = (await res.json()) as ApiEnvelope<EventModel[]>;
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης εκδηλώσεων');
        }
        if (!cancelled) setEvents(json.data ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setEventsError(e instanceof Error ? e.message : 'Σφάλμα');
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });

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
      // Keep selection behavior simple: Awesomplete will already replace the input value.
      // We only prevent any accidental default behavior.
      void ev;
    };

    // Awesomplete emits DOM CustomEvents on the input element.
    input.addEventListener('awesomplete-selectcomplete', onSelect as unknown as EventListener);
    return () => {
      input.removeEventListener('awesomplete-selectcomplete', onSelect as unknown as EventListener);
      awesompleteRef.current?.destroy();
      awesompleteRef.current = null;
    };
  }, []);

  const fetchSuggestions = useMemo(() => {
    let timer: number | null = null;
    return (raw: string) => {
      const q = raw.trim();
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
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
    };
  }, []);

  const scrollToSection = (label: HomeSectionKey) => {
    const id = sectionId(label);
    const el = sectionRefs.current[id];
    if (!el) return;
    setActive(label);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <section className="home-hero relative border-b border-neutral-100 md:h-[550px] md:overflow-hidden">
        {/* Desktop: lime panel from right column start to viewport edge (escapes max-width gap) */}
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
                      'h-14 rounded-full border-0 bg-white pl-14 pr-6 text-[16px] max-[600px]:text-[14px]',
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
            {/* Mobile: lime fill in stacked column; md+ uses section-level panel flush to viewport right */}
            <div
              className="absolute inset-0 rounded-t-[2.5rem] bg-[#d4f040] md:hidden"
              aria-hidden
            />
            <div className="relative z-10 flex h-full min-h-[280px] items-center justify-center p-6 md:min-h-[550px] md:p-8">
              <div className="w-full h-full max-w-lg rounded-2xl border border-neutral-200/80 bg-white/95 p-6 text-neutral-900 shadow-sm backdrop-blur-sm md:p-8">
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
                  to="/events"
                  className="mt-5 inline-flex w-fit rounded-full bg-[#6d28d9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 comfortaa-regular"
                >
                  Δες εκδηλώσεις
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label="Ενότητες αρχικής" className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div
            ref={tabsDrag.ref}
            className={cn(
              'flex items-stretch gap-8 overflow-x-auto',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'snap-x snap-mandatory',
              'touch-pan-x overscroll-x-contain',
            )}
            {...tabsDrag.handlers}
          >
            {sections.map((s) => {
              const isActive = s.label === active;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.label)}
                  className={cn(
                    'relative shrink-0 py-4 text-sm font-semibold transition-colors comfortaa-regular snap-start',
                    isActive ? 'text-neutral-950' : 'text-neutral-600 hover:text-neutral-900',
                  )}
                >
                  {s.label}
                  <span
                    className={cn(
                      'absolute left-0 right-0 -bottom-px h-[3px] rounded-full transition-opacity',
                      isActive ? 'bg-neutral-900 opacity-100' : 'bg-neutral-900 opacity-0',
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {sections.map((s, idx) => (
          <div
            key={s.id}
            id={s.id}
            ref={(el) => {
              sectionRefs.current[s.id] = el;
            }}
            className={cn(idx > 0 && 'mt-12')}
          >
            <SectionSwiper title={s.label}>
              {eventsLoading ? (
                <div className="text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</div>
              ) : eventsError ? (
                <div className="text-sm text-[var(--nexus-red)] comfortaa-regular">
                  {eventsError}
                </div>
              ) : events.length === 0 ? (
                <div className="text-sm text-neutral-600 comfortaa-regular">
                  Δεν υπάρχουν εκδηλώσεις ακόμα.
                </div>
              ) : (
                events.map((ev) => (
                  <div key={`${s.id}-${ev.id}`} className="snap-start">
                    <EventCard event={ev} />
                  </div>
                ))
              )}
            </SectionSwiper>
          </div>
        ))}
      </div>
    </>
  );
}
