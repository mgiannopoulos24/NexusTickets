export const WSMessageTypes = {
  new_message: 'new_message',
  unread_count: 'unread_count',
} as const;

export type WSMessageType = (typeof WSMessageTypes)[keyof typeof WSMessageTypes];

export interface WSNewMessagePayload {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface WSUnreadCountPayload {
  unread_count: number;
}

export interface WSEnvelope<TPayload = unknown> {
  type: WSMessageType;
  payload: TPayload;
}
