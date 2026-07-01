import { baseApi } from '@/utils/api';
import type { Event } from '@/types/models';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

export interface EventsQueryParams {
  page?: number;
  size?: number;
  category?: string;
  title?: string;
  q?: string;
  from?: string;
  to?: string;
  min_price?: number;
  max_price?: number;
  city?: string;
}

export const eventsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEvents: builder.query<PaginatedResponse<Event>, EventsQueryParams | void>({
      query: (params) => ({
        url: '/events',
        params: params ?? {},
      }),
      providesTags: ['Event'],
    }),
    getEvent: builder.query<ApiResponse<Event>, string>({
      query: (id) => `/events/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Event' as const, id }],
    }),
    getRecommended: builder.query<ApiResponse<Event[]>, void>({
      // Recommendations return a plain array under { data } (Req 13 endpoint).
      query: () => '/events/recommended',
      providesTags: ['Event'],
    }),
  }),
});

export const { useGetEventsQuery, useGetEventQuery, useGetRecommendedQuery } = eventsApi;
