import { unwrap, unwrapList, type ApiEnvelope } from '@/app/apiEnvelope';
import { baseApi } from '@/utils/api';
import type { Category, Event } from '@/types/models';

/**
 * Search criteria from assignment §8: category, title, free-text (description),
 * date range, ticket price and location. Field names mirror the API's query
 * parameters so the mapping stays obvious.
 */
export interface EventsQueryParams {
  /** Free-text over title, description, venue and city (Postgres FTS). */
  q?: string;
  /** Substring match on the title alone. */
  title?: string;
  /** Substring match on the city. */
  city?: string;
  /** Category ids; an event matches if it belongs to any of them. */
  category_ids?: string[];
  /** ISO timestamps bounding the event window. */
  start_at?: string;
  end_at?: string;
  min_price?: number;
  max_price?: number;
}

export type SearchArgs = EventsQueryParams & {
  limit: number;
  offset: number;
};

export type SearchMeta = {
  has_more: boolean;
  next_after_start?: string;
  next_after_id?: string;
};

export type SearchResult = {
  events: Event[];
  meta: SearchMeta;
};

/** Drops empty values so the URL only carries criteria the user actually set. */
function searchQueryString({ limit, offset, ...filters }: SearchArgs): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.title?.trim()) params.set('title', filters.title.trim());
  if (filters.city?.trim()) params.set('city', filters.city.trim());
  if (filters.category_ids?.length) params.set('category_ids', filters.category_ids.join(','));
  if (filters.start_at) params.set('start_at', filters.start_at);
  if (filters.end_at) params.set('end_at', filters.end_at);
  if (filters.min_price !== undefined) params.set('min_price', String(filters.min_price));
  if (filters.max_price !== undefined) params.set('max_price', String(filters.max_price));

  return params.toString();
}

/** One ticket type in a create/update payload; `id` updates a row in place. */
export type TicketTypeWrite = {
  id?: string;
  name: string;
  price: number;
  quantity: number;
};

/** The writable shape of an event, shared by create, organizer edit and admin edit. */
export type EventWritePayload = {
  title: string;
  description: string;
  venue: string;
  event_type: string;
  city: string;
  country: string | null;
  address: string | null;
  latitude?: number;
  longitude?: number;
  start_at: string;
  end_at: string;
  capacity: number;
  categories: string[];
  ticket_types: TicketTypeWrite[];
  featured_image_url?: string | null;
  event_detail?: unknown;
  /** Admin-only lifecycle override. */
  status?: string;
};

export const eventsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Browse/search published events. This hits /events/search rather than
     * /events, because /events is an unfiltered listing — pointing the filter
     * panel at it meant none of the criteria had any effect.
     */
    searchEvents: builder.query<SearchResult, SearchArgs>({
      query: (args) => ({ url: `/events/search?${searchQueryString(args)}` }),
      transformResponse: (response: unknown): SearchResult => ({
        events: unwrapList<Event>(response),
        meta: ((response as ApiEnvelope<Event[]>).meta as SearchMeta) ?? { has_more: false },
      }),
      providesTags: ['Event'],
    }),

    getEvent: builder.query<Event, string>({
      query: (id) => `/events/${encodeURIComponent(id)}`,
      transformResponse: (response: unknown): Event => unwrap<Event>(response),
      providesTags: (_result, _error, id) => [{ type: 'Event' as const, id }],
    }),

    getRecommended: builder.query<Event[], number | void>({
      // Recommendations return a plain array under { data } (Req 13 endpoint).
      query: (limit) => `/events/recommended${limit ? `?limit=${limit}` : ''}`,
      transformResponse: (response: unknown): Event[] => unwrapList<Event>(response),
      providesTags: ['Event'],
    }),

    listCategories: builder.query<Category[], void>({
      query: () => '/categories',
      transformResponse: (response: unknown): Category[] => unwrapList<Category>(response),
    }),

    // ---------------------------------------------------------------- organizer

    getOrganizerEvents: builder.query<Event[], { limit?: number; offset?: number } | void>({
      query: (args) => {
        const { limit = 100, offset = 0 } = args ?? {};
        return { url: `/events/organizer/me?limit=${limit}&offset=${offset}` };
      },
      transformResponse: (response: unknown): Event[] => unwrapList<Event>(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map((e) => ({ type: 'Event' as const, id: e.id })),
              { type: 'Event' as const, id: 'ORGANIZER' },
            ]
          : [{ type: 'Event' as const, id: 'ORGANIZER' }],
    }),

    createEvent: builder.mutation<Event, EventWritePayload>({
      query: (body) => ({ url: '/events/organizer', method: 'POST', body }),
      transformResponse: (response: unknown): Event => unwrap<Event>(response),
      invalidatesTags: [{ type: 'Event', id: 'ORGANIZER' }, 'Event'],
    }),

    updateEvent: builder.mutation<Event, { id: string; body: Partial<EventWritePayload> }>({
      query: ({ id, body }) => ({
        url: `/events/organizer/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: unknown): Event => unwrap<Event>(response),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Event', id }, { type: 'Event', id: 'ORGANIZER' }],
    }),

    publishEvent: builder.mutation<Event, string>({
      query: (id) => ({ url: `/events/organizer/${encodeURIComponent(id)}/publish`, method: 'PATCH' }),
      transformResponse: (response: unknown): Event => unwrap<Event>(response),
      invalidatesTags: (_r, _e, id) => [{ type: 'Event', id }, { type: 'Event', id: 'ORGANIZER' }, 'Event'],
    }),

    cancelEvent: builder.mutation<Event, string>({
      query: (id) => ({ url: `/events/organizer/${encodeURIComponent(id)}/cancel`, method: 'PATCH' }),
      transformResponse: (response: unknown): Event => unwrap<Event>(response),
      invalidatesTags: (_r, _e, id) => [{ type: 'Event', id }, { type: 'Event', id: 'ORGANIZER' }, 'Event'],
    }),

    deleteEvent: builder.mutation<void, string>({
      query: (id) => ({ url: `/events/organizer/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Event', id }, { type: 'Event', id: 'ORGANIZER' }, 'Event'],
    }),

    uploadFeaturedImage: builder.mutation<Event, { id: string; file: File; admin?: boolean }>({
      query: ({ id, file, admin }) => {
        const form = new FormData();
        form.append('file', file);
        return {
          url: admin
            ? `/events/admin/${encodeURIComponent(id)}/featured-image`
            : `/events/organizer/${encodeURIComponent(id)}/featured-image`,
          method: 'POST',
          body: form,
        };
      },
      transformResponse: (response: unknown): Event => unwrap<Event>(response),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Event', id }],
    }),

    uploadEventPhoto: builder.mutation<unknown, { id: string; file: File }>({
      query: ({ id, file }) => {
        const form = new FormData();
        form.append('file', file);
        return {
          url: `/events/organizer/${encodeURIComponent(id)}/photos`,
          method: 'POST',
          body: form,
        };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Event', id }],
    }),

    deleteEventPhoto: builder.mutation<void, { id: string; photoId: string }>({
      query: ({ id, photoId }) => ({
        url: `/events/organizer/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Event', id }],
    }),

    // ------------------------------------------------------------------- admin

    getAdminEvents: builder.query<Event[], { limit?: number; offset?: number } | void>({
      query: (args) => {
        const { limit = 100, offset = 0 } = args ?? {};
        return { url: `/events/admin?limit=${limit}&offset=${offset}` };
      },
      transformResponse: (response: unknown): Event[] => unwrapList<Event>(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map((e) => ({ type: 'Event' as const, id: e.id })),
              { type: 'Event' as const, id: 'ADMIN' },
            ]
          : [{ type: 'Event' as const, id: 'ADMIN' }],
    }),

    getAdminEvent: builder.query<Event, string>({
      query: (id) => `/events/admin/${encodeURIComponent(id)}`,
      transformResponse: (response: unknown): Event => unwrap<Event>(response),
      providesTags: (_r, _e, id) => [{ type: 'Event' as const, id }],
    }),

    adminUpdateEvent: builder.mutation<Event, { id: string; body: Partial<EventWritePayload> }>({
      query: ({ id, body }) => ({
        url: `/events/admin/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: unknown): Event => unwrap<Event>(response),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Event', id }, { type: 'Event', id: 'ADMIN' }, 'Event'],
    }),
  }),
});

export const {
  useSearchEventsQuery,
  useGetEventQuery,
  useGetRecommendedQuery,
  useListCategoriesQuery,
  useGetOrganizerEventsQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  usePublishEventMutation,
  useCancelEventMutation,
  useDeleteEventMutation,
  useUploadFeaturedImageMutation,
  useUploadEventPhotoMutation,
  useDeleteEventPhotoMutation,
  useGetAdminEventsQuery,
  useGetAdminEventQuery,
  useAdminUpdateEventMutation,
} = eventsApi;
