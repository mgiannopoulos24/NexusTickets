export const WSMessageTypes = {
  new_message: 'new_message',
  unread_count: 'unread_count',
  /** Travels both ways: the client announces typing, the server relays it. */
  typing: 'typing',
  /** A message was withdrawn, or its reactions changed. */
  message_deleted: 'message_deleted',
  reaction_changed: 'reaction_changed',
} as const;

export type WSMessageType = (typeof WSMessageTypes)[keyof typeof WSMessageTypes];

export interface WSNewMessagePayload {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  created_at: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  gif_url?: string;
}

export interface WSUnreadCountPayload {
  unread_count: number;
}

/** Someone is composing a message to us. */
export interface WSTypingPayload {
  user_id: string;
}

/**
 * A message in one of our threads changed. Both party ids travel with it,
 * because each side keys its thread by the *other* person.
 */
export interface WSMessageChangedPayload {
  id: string;
  sender_id: string;
  recipient_id: string;
}

export interface WSEnvelope<TPayload = unknown> {
  type: WSMessageType;
  payload: TPayload;
}
