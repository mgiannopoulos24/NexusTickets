import type {
  Attachment,
  Conversation,
  Message,
  MessageRecipient,
  SendMessageRequest,
} from '@/types/message';
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

/**
 * Appends a message to a cached thread if it is not already there. Both the
 * WebSocket push and our own send land here, so a message shows up without a
 * refetch — and a duplicate (push racing the mutation response) is ignored.
 */
export function appendToThread(draft: Message[], message: Message): void {
  if (draft.some((m) => m.id === message.id)) return;
  draft.push(message);
  draft.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

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

    /** The user's threads, newest activity first. Reading this marks nothing. */
    listConversations: build.query<Conversation[], void>({
      query: () => ({ url: '/messages/conversations', method: 'GET' }),
      transformResponse: (response: unknown): Conversation[] => unwrap<Conversation[]>(response),
      providesTags: [{ type: 'Message', id: 'CONVERSATIONS' }],
    }),

    /**
     * The whole exchange with one person, oldest first. The server marks their
     * side of it read, so the unread badge and the sidebar both change.
     */
    listThread: build.query<Message[], { userId: string; limit?: number; offset?: number }>({
      query: ({ userId, limit = 200, offset = 0 }) => ({
        url: `/messages/thread/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown): Message[] => unwrap<Message[]>(response),
      providesTags: (_result, _err, { userId }) => [{ type: 'Message' as const, id: `THREAD-${userId}` }],
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
      // Show our own message the moment the server confirms it, rather than
      // waiting for a refetch of the whole thread.
      async onQueryStarted({ recipient_id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            messagesApi.util.updateQueryData('listThread', { userId: recipient_id }, (draft) => {
              appendToThread(draft, data);
            }),
          );
        } catch {
          // The composer surfaces the failure; nothing to patch.
        }
      },
      // The sidebar preview and ordering still come from the server.
      invalidatesTags: [
        { type: 'Message' as const, id: 'sent' },
        { type: 'Message' as const, id: 'CONVERSATIONS' },
      ],
    }),

    /** Toggles one emoji on a message for the current user. */
    reactToMessage: build.mutation<void, { messageId: string; emoji: string; peerId: string }>({
      query: ({ messageId, emoji }) => ({
        url: `/messages/${encodeURIComponent(messageId)}/reactions`,
        method: 'POST',
        body: { emoji },
      }),
      invalidatesTags: (_r, _e, { peerId }) => [{ type: 'Message' as const, id: `THREAD-${peerId}` }],
    }),

    /** Stores a picture or file and hands back the URL to attach to a message. */
    uploadAttachment: build.mutation<Attachment, File>({
      query: (file) => {
        const form = new FormData();
        form.append('file', file);
        return { url: '/messages/attachments', method: 'POST', body: form };
      },
      transformResponse: (response: unknown): Attachment => unwrap<Attachment>(response),
    }),

    deleteMessage: build.mutation<void, { id: string; peerId: string }>({
      query: ({ id }) => ({ url: `/messages/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _err, { id, peerId }) => [
        { type: 'Message', id },
        { type: 'Message', id: `THREAD-${peerId}` },
        { type: 'Message', id: 'inbox' },
        { type: 'Message', id: 'sent' },
        { type: 'Message', id: 'UNREAD' },
        { type: 'Message', id: 'CONVERSATIONS' },
      ],
    }),
  }),
});

export const {
  useReactToMessageMutation,
  useUploadAttachmentMutation,
  useListConversationsQuery,
  useListThreadQuery,
  useListMessagesQuery,
  useListRecipientsQuery,
  useUnreadCountQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
} = messagesApi;
