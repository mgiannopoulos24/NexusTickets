import { Children, useId, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, A11y, Navigation } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper/types';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type SectionSwiperProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function SectionSwiper({ title, children, className }: SectionSwiperProps) {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const navId = useId().replaceAll(':', '');
  const prevClass = `swiper-nav-prev-${navId}`;
  const nextClass = `swiper-nav-next-${navId}`;

  const slides = useMemo(() => {
    return Children.toArray(children) as ReactNode[];
  }, [children]);

  return (
    <section className={cn('w-full', className)} aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-neutral-950 comfortaa-bold">{title}</h2>
        <div className="flex items-center gap-2">
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
            <SwiperSlide key={idx}>{node}</SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}

