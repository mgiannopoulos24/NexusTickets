/** Home page slider / section metadata. Labels resolve through the locale files. */
import { tr } from '@/lib/i18n';

export type HomeSliderKey = 'popular' | 'recommended' | 'new' | 'theater' | 'music' | 'cinema';

export type CategoryBrowseSlug =
  'theater' | 'music' | 'cinema' | 'sports' | 'child' | 'museums' | 'dance';

export const HOME_SLIDER_ORDER: HomeSliderKey[] = [
  'popular',
  'recommended',
  'new',
  'theater',
  'music',
  'cinema',
];

export function homeSectionLabel(key: HomeSliderKey): string {
  return tr(`home.sections.${key}`);
}

export function homeSectionSubtitle(key: HomeSliderKey): string {
  return tr(`home.subtitles.${key}`);
}

/** "See all …" link text per slider (category sliders link to browse by slug). */
export function homeViewAllLabel(key: HomeSliderKey): string {
  return tr(`home.viewAll.${key}`);
}

export function homeViewAllHref(key: HomeSliderKey): string {
  switch (key) {
    case 'theater':
      return '/events/category/theater';
    case 'music':
      return '/events/category/music';
    case 'cinema':
      return '/events/category/cinema';
    default:
      return '/events';
  }
}

/** Category filter chips (not event sliders) — browse by taxonomy. */
export const CATEGORY_BROWSE_CHIPS: ReadonlyArray<CategoryBrowseSlug> = [
  'theater',
  'music',
  'cinema',
  'sports',
];

export function categoryBrowseLabel(slug: CategoryBrowseSlug): string {
  return tr(`categories.${slug}`);
}
