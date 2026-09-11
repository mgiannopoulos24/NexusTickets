/**
 * "Events" navbar dropdown — label keys and targets.
 * Category slugs must exist in `CategoryBrowseSlug` / `EventsBrowsePage` + DB category names.
 */
export const EVENTS_NAV_DROPDOWN_ITEMS: ReadonlyArray<{
  label: string;
  to: string;
}> = [
  { label: 'navEvents.all', to: '/events' },
  { label: 'navEvents.offers', to: '/events?special=offers' },
  { label: 'navEvents.kids', to: '/events/category/child' },
  { label: 'navEvents.new', to: '/#home-section-new' },
  { label: 'navEvents.museums', to: '/events/category/museums' },
  { label: 'navEvents.dance', to: '/events/category/dance' },
  {
    label: 'navEvents.thessaloniki',
    to: `/events?city=${encodeURIComponent('Θεσσαλονίκη')}`,
  },
];
