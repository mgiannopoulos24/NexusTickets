import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useLang } from '@/contexts/langContext';
import { cn } from '@/lib/utils';

type PhotoGalleryProps = {
  images: string[];
  title: string;
  className?: string;
};

const SWIPE_PX = 40;

/**
 * The event's photos as one slider: a large cross-fading picture with arrows,
 * a thumbnail strip, keyboard arrows and pointer swipe.
 */
export function PhotoGallery({ images, title, className }: PhotoGalleryProps) {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const dragStart = useRef<number | null>(null);
  const count = images.length;

  const step = (delta: number) => setIndex((i) => (i + delta + count) % count);

  if (count === 0) {
    return (
      <div
        className={cn(
          'aspect-[16/9] w-full rounded-2xl bg-gradient-to-br from-violet-200 via-violet-400 to-purple-700',
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn('select-none', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={t('gallery.label')}
      data-testid="photo-gallery"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
      }}
    >
      <div
        className="relative aspect-[16/9] w-full touch-pan-y overflow-hidden rounded-2xl bg-neutral-900"
        onPointerDown={(e) => {
          dragStart.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (dragStart.current === null) return;
          const dx = e.clientX - dragStart.current;
          dragStart.current = null;
          if (Math.abs(dx) >= SWIPE_PX) step(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        {images.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={t('eventDetail.photoAlt', { title, n: i + 1 })}
            draggable={false}
            loading={i === 0 ? 'eager' : 'lazy'}
            aria-hidden={i !== index}
            data-testid="gallery-slide"
            data-active={i === index ? 'true' : undefined}
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none',
              i === index ? 'z-10 opacity-100' : 'z-0 opacity-0',
            )}
          />
        ))}

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t('gallery.previous')}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2 text-neutral-900 shadow hover:bg-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t('gallery.next')}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2 text-neutral-900 shadow hover:bg-white"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="comfortaa-regular absolute bottom-3 right-3 z-20 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {t('gallery.counter', { index: index + 1, count })}
            </span>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((src, i) => (
            <button
              key={`thumb-${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t('gallery.thumb', { n: i + 1 })}
              aria-current={i === index ? 'true' : undefined}
              className={cn(
                'h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition',
                i === index
                  ? 'ring-[var(--nexus-purple)]'
                  : 'ring-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={src} alt="" draggable={false} className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
