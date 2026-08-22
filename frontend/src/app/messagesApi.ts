import type { Message, MessageRecipient, SendMessageRequest } from '@/types/message';
import { baseApi } from '@/utils/api';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

function unwrap<T>(response: unknown): T {
  const body = response as ApiEnvelope<T>;
  if (body.error) {
    throw new Error(body.error.message ?? 'Σφάλμα αιτήματος');
  }
  if (body.data === null || body.data === undefined) {
    throw new Error('Άκυρη απάντηση');
  }
  return body.data;
}

export type MailboxArgs = {
  folder: 'inbox' | 'sent';
  limit: number;
  offset: number;
};

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMessages: build.query<Message[], MailboxArgs>({
      query: ({ folder, limit, offset }) => ({
        url: `/messages/${folder}?limit=${limit}&offset=${offset}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown): Message[] => unwrap<Message[]>(response),
      providesTags: (result, _err, { folder }) =>
        result
          ? [
              ...result.map((m) => ({ type: 'Message' as const, id: m.id })),
              { type: 'Message' as const, id: folder },
            ]
          : [{ type: 'Message' as const, id: folder }],
    }),

    /** Who the current user is allowed to write to (booking partners + support). */
    listRecipients: build.query<MessageRecipient[], void>({
      query: () => ({ url: '/messages/recipients', method: 'GET' }),
      transformResponse: (response: unknown): MessageRecipient[] =>
        unwrap<MessageRecipient[]>(response),
      providesTags: [{ type: 'Message', id: 'RECIPIENTS' }],
    }),

    unreadCount: build.query<number, void>({
      query: () => ({ url: '/messages/unread-count', method: 'GET' }),
      transformResponse: (response: unknown): number =>
        unwrap<{ count: number }>(response).count ?? 0,
      providesTags: [{ type: 'Message', id: 'UNREAD' }],
    }),

    sendMessage: build.mutation<Message, SendMessageRequest>({
      query: (body) => ({ url: '/messages', method: 'POST', body }),
      transformResponse: (response: unknown): Message => unwrap<Message>(response),
      // A sent message lands in the sender's Sent folder and, for the
      // recipient, changes nothing we cache locally.
      invalidatesTags: [{ type: 'Message', id: 'sent' }],
    }),

    deleteMessage: build.mutation<void, string>({
      query: (id) => ({ url: `/messages/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _err, id) => [
        { type: 'Message', id },
        { type: 'Message', id: 'inbox' },
        { type: 'Message', id: 'sent' },
        { type: 'Message', id: 'UNREAD' },
      ],
    }),
  }),
});

export const {
  useListMessagesQuery,
  useListRecipientsQuery,
  useUnreadCountQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
} = messagesApi;
