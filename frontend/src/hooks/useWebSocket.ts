import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { wsClient } from '@/utils/wsClient';
import { pushIncomingMessage, setUnreadCount } from '@/utils/messagingSlice';
import {
  WSMessageTypes,
  type WSEnvelope,
  type WSNewMessagePayload,
  type WSUnreadCountPayload,
} from '@/types/ws';

export function useWebSocket(): void {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.accessToken);

  useEffect(() => {
    if (!token) {
      wsClient.disconnect();
      return;
    }

    wsClient.connect(token);
    const unsubscribe = wsClient.subscribe((envelope: WSEnvelope) => {
      if (envelope.type === WSMessageTypes.new_message) {
        dispatch(pushIncomingMessage(envelope.payload as WSNewMessagePayload));
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
  }, [dispatch, token]);
}
