import { describe, expect, it } from 'vitest';

import reducer, { clearFilters, setFilter, setPage, setPageSize } from '@/app/eventsSlice';

const initial = reducer(undefined, { type: '@@INIT' });

describe('eventsSlice filters', () => {
  it('starts with no criteria on page 1', () => {
    expect(initial.filters).toEqual({});
    expect(initial.currentPage).toBe(1);
  });

  it('stores a text criterion', () => {
    const next = reducer(initial, setFilter({ key: 'city', value: 'Αθήνα' }));
    expect(next.filters.city).toBe('Αθήνα');
  });

  it('stores category ids as a list', () => {
    const next = reducer(initial, setFilter({ key: 'category_ids', value: ['a', 'b'] }));
    expect(next.filters.category_ids).toEqual(['a', 'b']);
  });

  it('removes a criterion when cleared with undefined', () => {
    const withCity = reducer(initial, setFilter({ key: 'city', value: 'Αθήνα' }));
    const cleared = reducer(withCity, setFilter({ key: 'city', value: undefined }));
    expect('city' in cleared.filters).toBe(false);
  });

  it('treats an empty string as clearing the criterion', () => {
    const withTitle = reducer(initial, setFilter({ key: 'title', value: 'Συναυλία' }));
    const cleared = reducer(withTitle, setFilter({ key: 'title', value: '' }));
    expect('title' in cleared.filters).toBe(false);
  });

  it('keeps a zero price rather than treating it as empty', () => {
    const next = reducer(initial, setFilter({ key: 'min_price', value: 0 }));
    expect(next.filters.min_price).toBe(0);
  });

  it('returns to page 1 whenever a criterion changes', () => {
    const onPage4 = reducer(initial, setPage(4));
    expect(onPage4.currentPage).toBe(4);

    const filtered = reducer(onPage4, setFilter({ key: 'q', value: 'jazz' }));
    expect(filtered.currentPage).toBe(1);
  });

  it('clearFilters drops every criterion and resets the page', () => {
    let state = reducer(initial, setFilter({ key: 'q', value: 'jazz' }));
    state = reducer(state, setFilter({ key: 'min_price', value: 10 }));
    state = reducer(state, setPage(3));

    const cleared = reducer(state, clearFilters());
    expect(cleared.filters).toEqual({});
    expect(cleared.currentPage).toBe(1);
  });

  it('changing page size returns to page 1', () => {
    const state = reducer(reducer(initial, setPage(5)), setPageSize(24));
    expect(state.pageSize).toBe(24);
    expect(state.currentPage).toBe(1);
  });
});
