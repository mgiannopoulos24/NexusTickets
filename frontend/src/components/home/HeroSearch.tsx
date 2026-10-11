import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, MapPin, Search } from 'lucide-react';

import { useSearchEventsQuery } from '@/app/eventsApi';
import { Input } from '@/components/ui/input';
import { useLang } from '@/contexts/langContextCore';
import { formatShortDate } from '@/helpers/formatDate';
import { cn } from '@/lib/utils';

/** Results shown under the box; the full list is one Enter away. */
export const HERO_SEARCH_LIMIT = 3;
/** Characters needed before the box starts asking the server. */
export const HERO_SEARCH_MIN_CHARS = 2;
/** Pause in typing before a request goes out. */
const DEBOUNCE_MS = 250;

/**
 * The hero's search box: results appear as the user types (at most
 * {@link HERO_SEARCH_LIMIT}), each a link to its event. Enter on a highlighted
 * result opens it; Enter otherwise opens the full results on /events.
 */
export function HeroSearch() {
  const { t } = useLang();
  const navigate = useNavigate();
  const listId = useId();

  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(text.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const tooShort = term.length < HERO_SEARCH_MIN_CHARS;
  const { currentData, isFetching, isError } = useSearchEventsQuery(
    { q: term, limit: HERO_SEARCH_LIMIT, offset: 0 },
    { skip: tooShort },
  );
  const results = (currentData?.events ?? []).slice(0, HERO_SEARCH_LIMIT);

  const showPanel = open && !tooShort && text.trim().length >= HERO_SEARCH_MIN_CHARS;
  const allHref = `/events?q=${encodeURIComponent(text.trim())}`;
  const optionId = (i: number) => `${listId}-option-${i}`;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        if (!results.length) return;
        e.preventDefault();
        setOpen(true);
        setActive((i) => (i + 1) % results.length);
        break;
      case 'ArrowUp':
        if (!results.length) return;
        e.preventDefault();
        setOpen(true);
        setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
        break;
      case 'Enter': {
        const q = text.trim();
        if (!q) return;
        e.preventDefault();
        setOpen(false);
        const picked = showPanel && active >= 0 ? results[active] : undefined;
        navigate(picked ? `/events/${encodeURIComponent(picked.id)}` : allHref);
        break;
      }
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
    }
  };

  return (
    <div className="relative">
      <label htmlFor="home-search" className="sr-only">
        {t('hero.search')}
      </label>
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-5 z-10 size-[18px] text-[var(--nexus-purple)]"
          aria-hidden={true}
        />
        <Input
          id="home-search"
          type="search"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
          placeholder={t('hero.searchPlaceholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            // New text brings new results, with nothing highlighted yet.
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(
            'h-[60px] w-full rounded-full border-0 bg-white pl-[50px] pr-12 text-[16px] max-[600px]:text-[14px]',
            'comfortaa-regular text-neutral-900 ring-0 placeholder:text-neutral-500',
            'max-[600px]:placeholder:text-[14px]',
            'transition-shadow duration-300 ease-out motion-reduce:transition-none',
            'shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_4px_6px_rgba(0,0,0,0.12)]',
            'hover:shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_6px_9px_rgba(0,0,0,0.2)]',
            'focus-visible:shadow-[0_0_0_2px_var(--nexus-purple),0_4px_6px_rgba(0,0,0,0.2)]',
            'focus-visible:ring-0 focus-visible:outline-none',
          )}
        />
        {showPanel && isFetching ? (
          <Loader2
            className="absolute right-5 size-[18px] animate-spin text-neutral-400"
            aria-hidden={true}
          />
        ) : null}
      </div>

      {showPanel ? (
        <div
          // Keep focus in the input while a result is clicked, so the blur
          // that closes the panel does not swallow the click.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-lg"
        >
          <ul id={listId} role="listbox" aria-label={t('hero.resultsLabel')}>
            {results.map((ev, i) => (
              <li key={ev.id} id={optionId(i)} role="option" aria-selected={i === active}>
                <Link
                  to={`/events/${encodeURIComponent(ev.id)}`}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    i === active ? 'bg-violet-50' : 'hover:bg-neutral-50',
                  )}
                >
                  {ev.featured_image_url ? (
                    <img
                      src={ev.featured_image_url}
                      alt=""
                      className="size-12 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="size-12 shrink-0 rounded-lg bg-gradient-to-br from-violet-200 via-violet-400 to-purple-700"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="comfortaa-bold block truncate text-sm text-neutral-900">
                      {ev.title}
                    </span>
                    <span className="comfortaa-regular flex items-center gap-1 truncate text-xs text-neutral-500">
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">
                        {[ev.venue, ev.city].filter(Boolean).join(', ')}
                      </span>
                    </span>
                  </span>
                  <span className="comfortaa-regular shrink-0 text-xs text-[var(--nexus-purple)]">
                    {formatShortDate(ev.start_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {isError || (currentData && results.length === 0) ? (
            <p className="comfortaa-regular px-4 py-3 text-sm text-neutral-500" role="status">
              {isError ? t('hero.searchError') : t('hero.noResults', { q: term })}
            </p>
          ) : null}

          {results.length > 0 ? (
            <Link
              to={allHref}
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="comfortaa-regular block border-t border-neutral-100 px-4 py-2.5 text-sm text-[var(--nexus-purple)] hover:bg-neutral-50"
            >
              {t('hero.allResults', { q: text.trim() })}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
