import { useEffect } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { useAuth } from '@/hooks/useAuth';
import { wsClient } from '@/utils/wsClient';
import { appendToThread, messagesApi } from '@/app/messagesApi';
import { clearTyping, markTyping, pushIncomingMessage, setUnreadCount } from '@/app/messagingSlice';
import {
  WSMessageTypes,
  type WSEnvelope,
  type WSMessageChangedPayload,
  type WSNewMessagePayload,
  type WSTypingPayload,
  type WSUnreadCountPayload,
} from '@/types/ws';

export function useWebSocket(): void {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) {
      wsClient.disconnect();
      return;
    }

    wsClient.connect(accessToken);
    const unsubscribe = wsClient.subscribe((envelope: WSEnvelope) => {
      if (
        envelope.type === WSMessageTypes.message_deleted ||
        envelope.type === WSMessageTypes.reaction_changed
      ) {
        // Whichever of the two we are, the thread is cached under the other
        // person, so invalidate both keys and let the subscribed one refetch.
        const payload = envelope.payload as WSMessageChangedPayload;
        dispatch(
          messagesApi.util.invalidateTags([
            { type: 'Message', id: `THREAD-${payload.sender_id}` },
            { type: 'Message', id: `THREAD-${payload.recipient_id}` },
            { type: 'Message', id: 'CONVERSATIONS' },
          ]),
        );
        return;
      }
      if (envelope.type === WSMessageTypes.typing) {
        const payload = envelope.payload as WSTypingPayload;
        dispatch(markTyping({ userId: payload.user_id, at: Date.now() }));
        return;
      }
      if (envelope.type === WSMessageTypes.new_message) {
        const payload = envelope.payload as WSNewMessagePayload;
        dispatch(pushIncomingMessage(payload));
        // The message arrived, so they have stopped typing.
        dispatch(clearTyping(payload.sender_id));
        // Splice it straight into the open thread so it appears immediately,
        // then let the sidebar refetch for the preview and ordering.
        dispatch(
          messagesApi.util.updateQueryData(
            'listThread',
            { userId: payload.sender_id },
            (draft) => {
              appendToThread(draft, {
                id: payload.id,
                sender_id: payload.sender_id,
                recipient_id: payload.recipient_id,
                subject: payload.subject,
                body: payload.body,
                read_at: null,
                created_at: payload.created_at,
                image_url: payload.image_url,
                file_url: payload.file_url,
                file_name: payload.file_name,
                gif_url: payload.gif_url,
              });
            },
          ),
        );
        dispatch(
          messagesApi.util.invalidateTags([
            { type: 'Message', id: 'CONVERSATIONS' },
            { type: 'Message', id: 'inbox' },
          ]),
        );
        return;
      }
      if (envelope.type === WSMessageTypes.unread_count) {
        const payload = envelope.payload as WSUnreadCountPayload;
        dispatch(setUnreadCount(payload.unread_count));
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, [dispatch, accessToken]);
}
