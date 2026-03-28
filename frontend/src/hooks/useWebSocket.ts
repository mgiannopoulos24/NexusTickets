import { useEffect } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { useAuth } from '@/hooks/useAuth';
import { wsClient } from '@/utils/wsClient';
import { pushIncomingMessage, setUnreadCount } from '@/app/messagingSlice';
import {
  WSMessageTypes,
  type WSEnvelope,
  type WSNewMessagePayload,
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
  }, [dispatch, accessToken]);
}
