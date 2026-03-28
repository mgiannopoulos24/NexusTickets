import type { CategoryBrowseSlug } from '@/constants/homeEventSections';

/** Match API category name (e.g. seeded Greek labels) to URL slug. */
const SLUG_KEYWORDS: Record<CategoryBrowseSlug, string[]> = {
  theater: ['θέατρο', 'theater', 'theatre'],
  music: ['μουσική', 'music'],
  cinema: ['σινεμά', 'σινεμα', 'cinema', 'κινηματογράφ'],
  sports: ['αθλητικ', 'sports', 'sport'],
  child: ['παιδικ', 'παιδί', 'child', 'kids'],
  museums: ['μουσεί', 'museum'],
  dance: ['χορός', 'χορου', 'dance'],
};

function normalizeName(raw: string): string {
  return raw.trim().toLocaleLowerCase('el-GR');
}

export function categoryIdForSlug(
  slug: CategoryBrowseSlug,
  categories: ReadonlyArray<{ id: string; name: string }>,
): string | null {
  const keywords = SLUG_KEYWORDS[slug];
  for (const c of categories) {
    const n = normalizeName(c.name);
    if (keywords.some((k) => n.includes(k))) {
      return c.id;
    }
  }
  return null;
}
