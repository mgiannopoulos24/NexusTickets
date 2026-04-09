import { baseApi } from '@/utils/api';
import type { Booking } from '@/types/models';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

export interface CreateBookingRequest {
  event_id: string;
  ticket_type_id: string;
  quantity: number;
}

export interface BookingsQueryParams {
  page?: number;
  size?: number;
}

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createBooking: builder.mutation<ApiResponse<Booking>, CreateBookingRequest>({
      query: (body) => ({
        url: '/bookings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Booking'],
    }),
    getMyBookings: builder.query<PaginatedResponse<Booking>, BookingsQueryParams | void>({
      query: (params) => ({
        url: '/bookings/me',
        params: params ?? {},
      }),
      providesTags: ['Booking'],
    }),
    getBooking: builder.query<ApiResponse<Booking>, string>({
      query: (id) => `/bookings/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Booking' as const, id }],
    }),
    getEventBookings: builder.query<
      PaginatedResponse<Booking>,
      { eventId: string; page?: number; size?: number }
    >({
      query: ({ eventId, ...params }) => ({
        url: `/bookings/organizer/events/${eventId}`,
        params,
      }),
      providesTags: ['Booking'],
    }),
  }),
});

export const {
  useCreateBookingMutation,
  useGetMyBookingsQuery,
  useGetBookingQuery,
  useGetEventBookingsQuery,
} = bookingsApi;
