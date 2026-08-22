import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { EventsQueryParams } from './eventsApi';

interface EventsState {
  filters: EventsQueryParams;
  currentPage: number;
  pageSize: number;
}

const initialState: EventsState = {
  filters: {},
  currentPage: 1,
  pageSize: 12,
};

type FilterKey = keyof EventsQueryParams;

/** A key paired with a value valid for that key (or undefined, to clear it). */
type FilterPayload = {
  key: FilterKey;
  value: EventsQueryParams[FilterKey];
};

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<FilterPayload>) => {
      const { key, value } = action.payload;
      if (value === undefined || value === '') {
        delete state.filters[key];
      } else {
        // The mapped payload type guarantees key and value line up; TypeScript
        // cannot narrow both sides of the assignment at once.
        (state.filters as Record<string, unknown>)[key] = value;
      }
      state.currentPage = 1; // Reset to first page on filter change
    },
    clearFilters: (state) => {
      state.filters = {};
      state.currentPage = 1;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.currentPage = 1;
    },
  },
});

export const { setFilter, clearFilters, setPage, setPageSize } = eventsSlice.actions;
export default eventsSlice.reducer;
