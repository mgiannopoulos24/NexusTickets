/**
 * "Εκδηλώσεις" navbar dropdown — labels and targets.
 * Category slugs must exist in `CategoryBrowseSlug` / `EventsBrowsePage` + DB category names.
 */
export const EVENTS_NAV_DROPDOWN_ITEMS: ReadonlyArray<{
  label: string;
  to: string;
}> = [
  { label: 'Όλα τα Θεάματα', to: '/events' },
  { label: 'Προσφορές', to: '/events?special=offers' },
  { label: 'Παιδικά', to: '/events/category/child' },
  { label: 'Νέα Θεάματα', to: '/#home-section-new' },
  { label: 'Μουσεία', to: '/events/category/museums' },
  { label: 'Χορός', to: '/events/category/dance' },
  {
    label: 'Θεσσαλονίκη',
    to: `/events?city=${encodeURIComponent('Θεσσαλονίκη')}`,
  },
];
