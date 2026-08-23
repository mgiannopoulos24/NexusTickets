import { describe, expect, it } from 'vitest';

import { eventsApi, type SearchArgs } from '@/app/eventsApi';
import { store } from '@/app/store';
import { baseApi } from '@/utils/api';
import { mockFetch } from '@/tests/helpers/mockFetch';

/**
 * Drives the endpoint the filter panel uses and returns the URL it requested:
 * every criterion the UI sets has to survive into the query string, and every
 * empty one has to stay out of it.
 */
async function search(args: SearchArgs): Promise<string> {
  store.dispatch(baseApi.util.resetApiState());
  const api = mockFetch({ '/events/search': () => [] });
  await store.dispatch(eventsApi.endpoints.searchEvents.initiate(args));
  return api.matching('/events/search')[0]?.url ?? '';
}

describe('event search query (§8 criteria)', () => {
  it('always carries paging', async () => {
    expect(await search({ limit: 12, offset: 24 })).toContain('limit=12&offset=24');
  });

  it('omits criteria the user did not set', async () => {
    const url = await search({ limit: 12, offset: 0 });
    for (const key of ['q=', 'title=', 'city=', 'category_ids=', 'min_price=', 'max_price=']) {
      expect(url).not.toContain(key);
    }
  });

  it('drops whitespace-only text', async () => {
    const url = await search({ limit: 12, offset: 0, q: '   ', title: '  ', city: '\t' });
    expect(url).not.toContain('q=');
    expect(url).not.toContain('title=');
    expect(url).not.toContain('city=');
  });

  it('trims the text it does send', async () => {
    expect(await search({ limit: 12, offset: 0, title: '  Jazz  ' })).toContain('title=Jazz');
  });

  it('joins several categories with a comma', async () => {
    const url = await search({ limit: 12, offset: 0, category_ids: ['a', 'b'] });
    expect(url).toContain(`category_ids=${encodeURIComponent('a,b')}`);
  });

  it('drops an empty category list', async () => {
    expect(await search({ limit: 12, offset: 0, category_ids: [] })).not.toContain('category_ids');
  });

  it('sends a zero price bound rather than treating it as unset', async () => {
    const url = await search({ limit: 12, offset: 0, min_price: 0, max_price: 50 });
    expect(url).toContain('min_price=0');
    expect(url).toContain('max_price=50');
  });

  it('sends the date range as given', async () => {
    const url = await search({
      limit: 12,
      offset: 0,
      start_at: '2026-10-01T00:00:00.000Z',
      end_at: '2026-10-31T00:00:00.000Z',
    });
    expect(url).toContain(`start_at=${encodeURIComponent('2026-10-01T00:00:00.000Z')}`);
    expect(url).toContain(`end_at=${encodeURIComponent('2026-10-31T00:00:00.000Z')}`);
  });

  it('escapes non-ASCII criteria', async () => {
    const url = await search({ limit: 12, offset: 0, city: 'Αθήνα' });
    expect(url).toContain(`city=${encodeURIComponent('Αθήνα')}`);
  });
});
