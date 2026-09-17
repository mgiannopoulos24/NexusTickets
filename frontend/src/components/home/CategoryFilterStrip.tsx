import type { HomeSliderKey } from '@/constants/homeEventSections';
import { useDragScroll } from '@/hooks/useDragScroll';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/langContextCore';

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

/** Height of the sticky tab row; the home page offsets its scroll targets by it. */
export const SECTION_TABS_HEIGHT_PX = 56;

/**
 * The "Κατηγορίες" heading scrolls away; the tab row below it sticks under the
 * navbar while the sections scroll past and lets go at the end of the sections
 * container. For that to work the row must be a direct child of the same
 * element that wraps the sections, so this component returns two siblings.
 */
export function CategoryFilterStrip({
  sectionTabs,
  activeSection,
  onSectionTabClick,
}: CategoryFilterStripProps) {
  const { ref: tabsRef, handlers: tabsHandlers } = useDragScroll<HTMLDivElement>();
  const { t } = useLang();

  return (
    <>
      <section className="bg-neutral-50/80" aria-label={t('home.categories.ariaLabel')}>
        <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-3 sm:px-6 lg:px-8">
          <h2 className="text-lg font-bold text-neutral-950 comfortaa-bold">
            {t('home.categories.title')}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 comfortaa-regular">
            {t('home.categories.hint')}
          </p>
        </div>
      </section>

      <nav
        aria-label={t('home.categories.tabsLabel')}
        className="sticky top-16 z-30 border-y border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div
            ref={tabsRef}
            className={cn(
              // overflow-x-auto also clips vertically, so the active-tab
              // underline has to sit inside the box rather than 1px below it.
              'flex items-stretch gap-8 overflow-x-auto',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'snap-x snap-mandatory',
              'touch-pan-x overscroll-x-contain',
            )}
            style={{ height: SECTION_TABS_HEIGHT_PX }}
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
                    'relative shrink-0 text-sm font-semibold transition-colors comfortaa-regular snap-start',
                    isActive ? 'text-neutral-950' : 'text-neutral-600 hover:text-neutral-900',
                  )}
                >
                  {s.label}
                  <span
                    className={cn(
                      'absolute bottom-0 left-0 right-0 h-[3px] rounded-full transition-opacity',
                      isActive ? 'bg-nexus-coral opacity-100' : 'bg-nexus-coral opacity-0',
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
