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

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<{ key: keyof EventsQueryParams; value: any }>) => {
      const { key, value } = action.payload;
      state.filters[key] = value;
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
