import { baseApi } from '@/utils/api';
import type {
  ChatRoom,
  ChatMessage,
  Conversation,
  CreateChatRoomRequest,
  SendMessageRequest,
  ReactRequest,
} from '@/types/chat';

export const chatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query<Conversation[], void>({
      query: () => '/chat/conversations',
    }),
    getOrCreateRoom: builder.mutation<ChatRoom, CreateChatRoomRequest>({
      query: (body) => ({
        url: '/chat/rooms',
        method: 'POST',
        body,
      }),
    }),
    getMessages: builder.query<ChatMessage[], string>({
      query: (roomId) => `/chat/rooms/${roomId}/messages`,
    }),
    sendMessage: builder.mutation<ChatMessage, { roomId: string; body: SendMessageRequest }>({
      query: ({ roomId, body }) => ({
        url: `/chat/rooms/${roomId}/messages`,
        method: 'POST',
        body,
      }),
    }),
    reactToMessage: builder.mutation<{ id: string }, { messageId: string; body: ReactRequest }>({
      query: ({ messageId, body }) => ({
        url: `/chat/messages/${messageId}/reactions`,
        method: 'POST',
        body,
      }),
    }),
    removeReaction: builder.mutation<void, { messageId: string; reactionType: string }>({
      query: ({ messageId, reactionType }) => ({
        url: `/chat/messages/${messageId}/reactions?type=${reactionType}`,
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useGetConversationsQuery,
  useGetOrCreateRoomMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  useReactToMessageMutation,
  useRemoveReactionMutation,
} = chatApi;