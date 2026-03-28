/** Home page slider / section metadata (Greek UI). */

export type HomeSliderKey = 'popular' | 'recommended' | 'new' | 'theater' | 'music' | 'cinema';

export type CategoryBrowseSlug =
  | 'theater'
  | 'music'
  | 'cinema'
  | 'sports'
  | 'child'
  | 'museums'
  | 'dance';

export const HOME_SLIDER_ORDER: HomeSliderKey[] = [
  'popular',
  'recommended',
  'new',
  'theater',
  'music',
  'cinema',
];

export const HOME_SECTION_LABELS: Record<HomeSliderKey, string> = {
  popular: 'Δημοφιλή',
  recommended: 'Προτεινόμενα',
  new: 'Νέα',
  theater: 'Θέατρο',
  music: 'Μουσική',
  cinema: 'Σινεμά',
};

export const HOME_SECTION_SUBTITLES: Record<HomeSliderKey, string> = {
  popular: 'Οι πιο πολυζητημένες εκδηλώσεις αυτή την περίοδο',
  recommended: 'Επιλογές που ίσως σου ταιριάζουν',
  new: 'Πρόσφατες προσθήκες στην πλατφόρμα',
  theater: 'Παραστάσεις και δρώμενα σε σκηνές κοντά σου',
  music: 'Συναυλίες και μουσικές βραδιές',
  cinema: 'Οι πιο δημοφιλείς κινηματογράφοι',
};

/** "Δες όλα …" link text per slider (category sliders link to browse by slug). */
export function homeViewAllLabel(key: HomeSliderKey): string {
  switch (key) {
    case 'popular':
      return 'Δες όλα τα δημοφιλή';
    case 'recommended':
      return 'Δες όλες τις προτάσεις';
    case 'new':
      return 'Δες όλες τις νέες';
    case 'theater':
      return 'Δες όλα τα θέατρα';
    case 'music':
      return 'Δες όλη τη μουσική';
    case 'cinema':
      return 'Δες όλα τα σινεμά';
    default:
      return 'Δες όλα';
  }
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
export const CATEGORY_BROWSE_CHIPS: Array<{
  slug: CategoryBrowseSlug;
  label: string;
}> = [
  { slug: 'theater', label: 'Θέατρο' },
  { slug: 'music', label: 'Μουσική' },
  { slug: 'cinema', label: 'Σινεμά' },
  { slug: 'sports', label: 'Αθλητικά' },
];
