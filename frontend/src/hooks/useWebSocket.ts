import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAppDispatch } from '@/app/hooks';
import { messagesApi, useGetUnreadCountQuery } from '@/app/messagesApi';
import { supportApi } from '@/app/supportApi';
import { setUnreadCount } from '@/app/messagingSlice';
import { useAuth } from '@/hooks/useAuth';
import { wsClient } from '@/utils/wsClient';
import {
  WSMessageTypes,
  type WSEnvelope,
  type WSNewMessagePayload,
  type WSSupportUpdatePayload,
  type WSUnreadCountPayload,
} from '@/types/ws';
import { tr } from '@/lib/i18n';

/**
 * Keeps the push channel open while signed in. The server sends two things:
 * the unread total (drives the navbar badge) and each new inbox message, which
 * refreshes an open inbox and pops a toast so the arrival is visible wherever
 * the user is in the app (assignment §10). Toasts carry a "View" action that
 * navigates to the message or support ticket.
 */
export function useWebSocket(): void {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  // The socket only reports changes, so the badge starts from a REST read.
  const { data: initialUnread } = useGetUnreadCountQuery(undefined, { skip: !accessToken });
  useEffect(() => {
    if (typeof initialUnread === 'number') dispatch(setUnreadCount(initialUnread));
  }, [dispatch, initialUnread]);

  useEffect(() => {
    if (!accessToken) {
      wsClient.disconnect();
      return;
    }

    wsClient.connect(accessToken);
    const unsubscribe = wsClient.subscribe((envelope: WSEnvelope) => {
      if (envelope.type === WSMessageTypes.new_message) {
        const payload = envelope.payload as WSNewMessagePayload;
        dispatch(messagesApi.util.invalidateTags([{ type: 'Message', id: 'inbox' }]));
        const href = `/messages?folder=inbox&id=${encodeURIComponent(payload.id)}`;
        toast.message(tr('ws.newMessage'), {
          description: payload.subject,
          id: `message-${payload.id}`,
          action: { label: tr('ws.view'), onClick: () => navigate(href) },
        });
        return;
      }
      if (envelope.type === WSMessageTypes.unread_count) {
        const payload = envelope.payload as WSUnreadCountPayload;
        dispatch(setUnreadCount(payload.count));
        return;
      }
      if (envelope.type === WSMessageTypes.support_update) {
        const payload = envelope.payload as WSSupportUpdatePayload;
        // Refresh the queue / list and the open thread, wherever they are shown.
        dispatch(
          supportApi.util.invalidateTags([
            { type: 'Support', id: 'LIST' },
            { type: 'Support', id: payload.ticket_id },
          ]),
        );
        const title = payload.by_admin
          ? payload.action === 'closed'
            ? tr('ws.ticketClosedForYou')
            : tr('ws.ticketAnswered')
          : payload.action === 'opened'
            ? tr('ws.ticketOpened')
            : payload.action === 'closed'
              ? tr('ws.ticketClosedByUser')
              : tr('ws.ticketReplied');
        toast.message(title, {
          description: payload.subject,
          id: `support-${payload.ticket_id}-${payload.action}`,
          action: {
            label: tr('ws.view'),
            onClick: () =>
              navigate(
                payload.by_admin
                  ? `/support?id=${encodeURIComponent(payload.ticket_id)}`
                  : `/admin/support?id=${encodeURIComponent(payload.ticket_id)}`,
              ),
          },
        });
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, [dispatch, navigate, accessToken]);
}
