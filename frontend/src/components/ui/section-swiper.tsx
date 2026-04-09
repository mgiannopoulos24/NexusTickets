import { Children, useId, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, A11y, Navigation } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper/types';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type SectionSwiperProps = {
  title: string;
  /** Secondary line under the title (gray, smaller). */
  subtitle?: string;
  /** Right-aligned “view all” link (e.g. category browse). */
  viewAllHref?: string;
  viewAllLabel?: string;
  children: ReactNode;
  className?: string;
};

export function SectionSwiper({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
  children,
  className,
}: SectionSwiperProps) {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const navId = useId().replaceAll(':', '');
  const prevClass = `swiper-nav-prev-${navId}`;
  const nextClass = `swiper-nav-next-${navId}`;

  const slides = useMemo(() => {
    return Children.toArray(children) as ReactNode[];
  }, [children]);

  return (
    <section className={cn('w-full', className)} aria-label={title}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-950 comfortaa-bold">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-neutral-500 comfortaa-regular">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          {viewAllHref && viewAllLabel ? (
            <Link
              to={viewAllHref}
              className="text-sm font-semibold text-[#6d28d9] transition hover:text-[#5b21b6] comfortaa-regular"
            >
              {viewAllLabel}
            </Link>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('rounded-full', prevClass)}
            aria-label="Προηγούμενα"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('rounded-full', nextClass)}
            aria-label="Επόμενα"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Button>
        </div>
      </div>

      <div
        onMouseEnter={() => swiperRef.current?.autoplay?.stop()}
        onMouseLeave={() => swiperRef.current?.autoplay?.start()}
      >
        <Swiper
          modules={[Autoplay, A11y, Navigation]}
          onSwiper={(s) => {
            swiperRef.current = s;
          }}
          grabCursor
          slidesPerView={2}
          spaceBetween={24}
          breakpoints={{
            768: { slidesPerView: 3, spaceBetween: 24 },
            1024: { slidesPerView: 4, spaceBetween: 24 },
          }}
          autoplay={{
            delay: 2500,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          navigation={{
            prevEl: `.${prevClass}`,
            nextEl: `.${nextClass}`,
          }}
          a11y={{
            enabled: true,
          }}
        >
          {slides.map((node, idx) => (
            <SwiperSlide key={idx} className="!h-auto flex">
              {node}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
