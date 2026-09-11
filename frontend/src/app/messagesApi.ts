import { unwrap, unwrapList, type ApiEnvelope } from '@/app/apiEnvelope';
import { baseApi } from '@/utils/api';
import type {
  MailboxFolder,
  MailboxPage,
  Message,
  MessageRecipient,
  NotifyAttendeesRequest,
  SendMessageRequest,
} from '@/types/message';

export type MailboxArgs = {
  folder: MailboxFolder;
  limit: number;
  offset: number;
};

type MailboxMeta = { total?: number; limit?: number; offset?: number };

/**
 * The mailbox of assignment §10: inbox and sent folders, open / delete one
 * message, compose to someone you share a booking with, and the organizer's
 * notice to everyone who booked an event.
 */
export const messagesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMailbox: build.query<MailboxPage, MailboxArgs>({
      query: ({ folder, limit, offset }) => ({
        url: `/messages/${folder}?limit=${limit}&offset=${offset}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown, _meta, { limit, offset }): MailboxPage => {
        const body = response as ApiEnvelope<Message[]>;
        const messages = unwrapList<Message>(body);
        const meta = (body.meta ?? {}) as MailboxMeta;
        return {
          messages,
          total: meta.total ?? messages.length,
          limit: meta.limit ?? limit,
          offset: meta.offset ?? offset,
        };
      },
      providesTags: (result, _err, { folder }) => [
        { type: 'Message' as const, id: folder },
        ...(result?.messages ?? []).map((m) => ({ type: 'Message' as const, id: m.id })),
      ],
    }),

    /** Opens one message. For the recipient the server marks it read. */
    getMessage: build.query<Message, string>({
      query: (id) => ({ url: `/messages/${encodeURIComponent(id)}`, method: 'GET' }),
      transformResponse: (response: unknown): Message => unwrap<Message>(response),
      providesTags: (_result, _err, id) => [{ type: 'Message' as const, id }],
      // Opening marks it read on the server, so refresh the inbox page for the
      // row to lose its "new" mark (the badge itself arrives over the socket).
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.read_at) {
            dispatch(messagesApi.util.invalidateTags([{ type: 'Message', id: 'inbox' }]));
          }
        } catch {
          // The page renders the error; nothing to roll back.
        }
      },
    }),

    getUnreadCount: build.query<number, void>({
      query: () => ({ url: '/messages/unread-count', method: 'GET' }),
      transformResponse: (response: unknown): number => unwrap<{ count: number }>(response).count,
      providesTags: [{ type: 'Message' as const, id: 'unread' }],
    }),

    listRecipients: build.query<MessageRecipient[], void>({
      query: () => ({ url: '/messages/recipients', method: 'GET' }),
      transformResponse: (response: unknown): MessageRecipient[] =>
        unwrapList<MessageRecipient>(response),
      providesTags: [{ type: 'Message' as const, id: 'recipients' }],
    }),

    sendMessage: build.mutation<Message, SendMessageRequest>({
      query: (body) => ({ url: '/messages', method: 'POST', body }),
      transformResponse: (response: unknown): Message => unwrap<Message>(response),
      invalidatesTags: [{ type: 'Message', id: 'sent' }],
    }),

    notifyAttendees: build.mutation<{ recipients: number }, NotifyAttendeesRequest>({
      query: ({ event_id, subject, body }) => ({
        url: `/messages/events/${encodeURIComponent(event_id)}/notify`,
        method: 'POST',
        body: { subject, body },
      }),
      transformResponse: (response: unknown): { recipients: number } =>
        unwrap<{ recipients: number }>(response),
      invalidatesTags: [{ type: 'Message', id: 'sent' }],
    }),

    /** Removes the message from the caller's own folder only. */
    deleteMessage: build.mutation<void, { id: string; folder: MailboxFolder }>({
      query: ({ id }) => ({ url: `/messages/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _err, { id, folder }) => [
        { type: 'Message', id },
        { type: 'Message', id: folder },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListMailboxQuery,
  useGetMessageQuery,
  useGetUnreadCountQuery,
  useListRecipientsQuery,
  useSendMessageMutation,
  useNotifyAttendeesMutation,
  useDeleteMessageMutation,
} = messagesApi;
