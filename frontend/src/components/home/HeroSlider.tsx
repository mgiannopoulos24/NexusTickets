import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatShortDate } from '@/helpers/formatDate';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/models';
import { useLang } from '@/contexts/langContextCore';

const AUTOPLAY_MS = 5000;
/** How far a pointer must travel to count as a swipe rather than a click. */
const SWIPE_PX = 40;

type HeroSliderProps = {
  events: Event[];
  /** Reports the active slide so the page can recolour the band behind it. */
  onIndexChange?: (index: number) => void;
  className?: string;
};

/**
 * Cross-fading poster slider of featured events, after more.com's hero: no
 * visible pagination, but swipeable (pointer drag) and steerable with the
 * arrow keys. Autoplays, pauses while hovered or focused, and each slide
 * links to its event.
 */
export function HeroSlider({ events, onIndexChange, className }: HeroSliderProps) {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = events.length;

  const dragStart = useRef<number | null>(null);
  // Set while a drag is in progress so the slide's link does not fire on release.
  const swiped = useRef(false);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const step = useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => step(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, count, step]);

  if (count === 0) return null;

  return (
    <div
      className={cn('relative w-full select-none', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
      }}
      onPointerDown={(e) => {
        dragStart.current = e.clientX;
        swiped.current = false;
      }}
      onPointerMove={(e) => {
        if (dragStart.current === null || swiped.current) return;
        const dx = e.clientX - dragStart.current;
        if (Math.abs(dx) >= SWIPE_PX) {
          swiped.current = true;
          step(dx < 0 ? 1 : -1);
        }
      }}
      onPointerUp={() => {
        dragStart.current = null;
      }}
      onPointerCancel={() => {
        dragStart.current = null;
      }}
      onClickCapture={(e) => {
        if (swiped.current) {
          e.preventDefault();
          e.stopPropagation();
          swiped.current = false;
        }
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={t('hero.featured')}
      data-testid="hero-slider"
    >
      <div className="relative aspect-[816/465] w-full touch-pan-y overflow-hidden rounded-md bg-neutral-900 shadow-[0_0_25px_rgba(0,0,0,0.3)]">
        {events.map((ev, i) => {
          const active = i === index;
          return (
            <Link
              key={ev.id}
              to={`/events/${encodeURIComponent(ev.id)}`}
              tabIndex={active ? 0 : -1}
              aria-hidden={!active}
              draggable={false}
              data-testid="hero-slide"
              data-active={active ? 'true' : undefined}
              className={cn(
                'absolute inset-0 block transition-opacity duration-700 ease-out motion-reduce:transition-none',
                active ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0',
              )}
            >
              {ev.featured_image_url ? (
                <img
                  src={ev.featured_image_url}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              ) : (
                <div className="size-full bg-gradient-to-br from-violet-300 via-violet-500 to-purple-800" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-6 pb-5 pt-16 text-center text-white">
                <p className="comfortaa-bold text-lg font-bold leading-tight [text-shadow:1px_1px_3px_rgba(0,0,0,.5)] sm:text-2xl lg:text-[28px]">
                  {ev.title}
                </p>
                <p className="comfortaa-regular mt-1 text-sm [text-shadow:1px_1px_3px_rgba(0,0,0,.5)] sm:text-base">
                  {[ev.venue, ev.city].filter(Boolean).join(', ')}
                  {ev.start_at ? ` · ${formatShortDate(ev.start_at)}` : ''}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {t('hero.slideOf', { index: index + 1, count })}
      </p>
    </div>
  );
}
