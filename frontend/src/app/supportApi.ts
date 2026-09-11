import { unwrap, unwrapList, type ApiEnvelope } from '@/app/apiEnvelope';
import { baseApi } from '@/utils/api';
import type {
  SupportCounts,
  SupportThread,
  SupportTicket,
  SupportTicketPage,
  SupportTicketStatus,
} from '@/types/support';

type ListMeta = { total?: number; limit?: number; offset?: number };

function toPage(response: unknown, limit: number, offset: number): SupportTicketPage {
  const body = response as ApiEnvelope<SupportTicket[]>;
  const tickets = unwrapList<SupportTicket>(body);
  const meta = (body.meta ?? {}) as ListMeta;
  return {
    tickets,
    total: meta.total ?? tickets.length,
    limit: meta.limit ?? limit,
    offset: meta.offset ?? offset,
  };
}

/**
 * Support tickets: a user's requests to the administration and the admin
 * queue. Tag `Support` covers lists and counts; each thread has its own id.
 */
export const supportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMyTickets: build.query<SupportTicketPage, { limit: number; offset: number }>({
      query: ({ limit, offset }) => ({
        url: `/support/tickets/me?limit=${limit}&offset=${offset}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown, _meta, { limit, offset }) =>
        toPage(response, limit, offset),
      providesTags: [{ type: 'Support' as const, id: 'LIST' }],
    }),

    listAllTickets: build.query<
      SupportTicketPage,
      { status?: SupportTicketStatus; limit: number; offset: number }
    >({
      query: ({ status, limit, offset }) => ({
        url: `/support/admin/tickets?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ''}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown, _meta, { limit, offset }) =>
        toPage(response, limit, offset),
      providesTags: [{ type: 'Support' as const, id: 'LIST' }],
    }),

    getSupportCounts: build.query<SupportCounts, void>({
      query: () => ({ url: '/support/admin/counts', method: 'GET' }),
      transformResponse: (response: unknown) => unwrap<SupportCounts>(response),
      providesTags: [{ type: 'Support' as const, id: 'LIST' }],
    }),

    getTicket: build.query<SupportThread, string>({
      query: (id) => ({ url: `/support/tickets/${encodeURIComponent(id)}`, method: 'GET' }),
      transformResponse: (response: unknown) => unwrap<SupportThread>(response),
      providesTags: (_r, _e, id) => [{ type: 'Support' as const, id }],
    }),

    openTicket: build.mutation<SupportTicket, { subject: string; body: string }>({
      query: (body) => ({ url: '/support/tickets', method: 'POST', body }),
      transformResponse: (response: unknown) => unwrap<SupportTicket>(response),
      invalidatesTags: [{ type: 'Support', id: 'LIST' }],
    }),

    replyToTicket: build.mutation<SupportThread, { id: string; body: string }>({
      query: ({ id, body }) => ({
        url: `/support/tickets/${encodeURIComponent(id)}/messages`,
        method: 'POST',
        body: { body },
      }),
      transformResponse: (response: unknown) => unwrap<SupportThread>(response),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Support', id },
        { type: 'Support', id: 'LIST' },
      ],
    }),

    closeTicket: build.mutation<SupportThread, string>({
      query: (id) => ({ url: `/support/tickets/${encodeURIComponent(id)}/close`, method: 'PATCH' }),
      transformResponse: (response: unknown) => unwrap<SupportThread>(response),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Support', id },
        { type: 'Support', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListMyTicketsQuery,
  useListAllTicketsQuery,
  useGetSupportCountsQuery,
  useGetTicketQuery,
  useOpenTicketMutation,
  useReplyToTicketMutation,
  useCloseTicketMutation,
} = supportApi;
