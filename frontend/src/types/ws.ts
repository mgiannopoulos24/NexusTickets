export const WSMessageTypes = {
  /** A message just landed in our inbox. */
  new_message: 'new_message',
  /** Our unread total changed. */
  unread_count: 'unread_count',
  /** A support ticket we are party to was opened, replied to or closed. */
  support_update: 'support_update',
} as const;

export type WSMessageType = (typeof WSMessageTypes)[keyof typeof WSMessageTypes];

export interface WSNewMessagePayload {
  id: string;
  sender_id: string;
  recipient_id: string;
  event_id: string | null;
  subject: string;
  body: string;
  created_at: string;
}

export interface WSUnreadCountPayload {
  count: number;
}

export interface WSEnvelope<TPayload = unknown> {
  type: WSMessageType;
  payload: TPayload;
}

export interface WSSupportUpdatePayload {
  ticket_id: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  action: 'opened' | 'replied' | 'closed';
  by_admin: boolean;
}
