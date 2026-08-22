import { Link } from 'react-router-dom';

import { CATEGORY_BROWSE_CHIPS, type HomeSliderKey } from '@/constants/homeEventSections';
import { useDragScroll } from '@/hooks/useDragScroll';
import { cn } from '@/lib/utils';

export type HomeSectionTab = {
  key: HomeSliderKey;
  id: string;
  label: string;
};

type CategoryFilterStripProps = {
  sectionTabs: HomeSectionTab[];
  activeSection: HomeSliderKey;
  onSectionTabClick: (key: HomeSliderKey) => void;
};

export function CategoryFilterStrip({
  sectionTabs,
  activeSection,
  onSectionTabClick,
}: CategoryFilterStripProps) {
  const { ref: tabsRef, handlers: tabsHandlers } = useDragScroll<HTMLDivElement>();

  return (
    <section
      className="border-b border-neutral-200 bg-neutral-50/80"
      aria-label="Κατηγορίες εκδηλώσεων"
    >
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-950 comfortaa-bold">Κατηγορίες</h2>
            <p className="mt-0.5 text-sm text-neutral-500 comfortaa-regular">
              Φίλτρα για πλήρη λίστα ανά είδος εκδήλωσης
            </p>
          </div>

          <nav
            aria-label="Ενότητες αρχικής"
            className="-mx-4 border-t border-neutral-200/80 bg-white px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          >
            <div
              ref={tabsRef}
              className={cn(
                'flex items-stretch gap-8 overflow-x-auto',
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                'snap-x snap-mandatory',
                'touch-pan-x overscroll-x-contain',
              )}
              {...tabsHandlers}
            >
              {sectionTabs.map((s) => {
                const isActive = s.key === activeSection;
                return (
                  <button
                    key={s.id}
                    type="button"
                    id={`tab-${s.id}`}
                    aria-controls={s.id}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => onSectionTabClick(s.key)}
                    className={cn(
                      'relative shrink-0 py-4 text-sm font-semibold transition-colors comfortaa-regular snap-start',
                      isActive ? 'text-neutral-950' : 'text-neutral-600 hover:text-neutral-900',
                    )}
                  >
                    {s.label}
                    <span
                      className={cn(
                        'absolute -bottom-px left-0 right-0 h-[3px] rounded-full transition-opacity',
                        isActive ? 'bg-neutral-900 opacity-100' : 'bg-neutral-900 opacity-0',
                      )}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex flex-wrap gap-2 pt-1">
            {CATEGORY_BROWSE_CHIPS.map(({ slug, label }) => (
              <Link
                key={slug}
                to={`/events/category/${slug}`}
                className={cn(
                  'rounded-full border border-[#6d28d9]/30 bg-white px-4 py-2 text-sm font-medium text-[#6d28d9]',
                  'transition hover:border-[#6d28d9] hover:bg-[#6d28d9]/5 comfortaa-regular',
                )}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/events"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 comfortaa-regular"
            >
              Όλες οι εκδηλώσεις
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
