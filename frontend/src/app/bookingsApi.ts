import { unwrap, unwrapList } from '@/app/apiEnvelope';
import { baseApi } from '@/utils/api';
import type { Booking } from '@/types/models';

export interface CreateBookingRequest {
  event_id: string;
  ticket_type_id: string;
  quantity: number;
}

/** The API pages with limit/offset, not page/size. */
export interface BookingsPageArgs {
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 50;

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createBooking: builder.mutation<Booking, CreateBookingRequest>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      transformResponse: (response: unknown): Booking => unwrap<Booking>(response),
      // A booking changes the event's remaining seats, so the event caches
      // have to be re-read as well.
      invalidatesTags: (_result, _err, { event_id }) => [
        'Booking',
        'Event',
        { type: 'Event', id: event_id },
      ],
    }),

    getMyBookings: builder.query<Booking[], BookingsPageArgs | void>({
      query: (args) => {
        const { limit = DEFAULT_LIMIT, offset = 0 } = args ?? {};
        return { url: `/bookings/me?limit=${limit}&offset=${offset}` };
      },
      transformResponse: (response: unknown): Booking[] => unwrapList<Booking>(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map((b) => ({ type: 'Booking' as const, id: b.id })),
              { type: 'Booking' as const, id: 'MINE' },
            ]
          : [{ type: 'Booking' as const, id: 'MINE' }],
    }),

    getBooking: builder.query<Booking, string>({
      query: (id) => `/bookings/${encodeURIComponent(id)}`,
      transformResponse: (response: unknown): Booking => unwrap<Booking>(response),
      providesTags: (_result, _error, id) => [{ type: 'Booking' as const, id }],
    }),

    getEventBookings: builder.query<Booking[], { eventId: string } & BookingsPageArgs>({
      query: ({ eventId, limit = 100, offset = 0 }) => ({
        url: `/bookings/organizer/events/${encodeURIComponent(eventId)}?limit=${limit}&offset=${offset}`,
      }),
      transformResponse: (response: unknown): Booking[] => unwrapList<Booking>(response),
      providesTags: (_result, _err, { eventId }) => [{ type: 'Booking' as const, id: eventId }],
    }),
  }),
});

export const {
  useCreateBookingMutation,
  useGetMyBookingsQuery,
  useGetBookingQuery,
  useGetEventBookingsQuery,
} = bookingsApi;
