import type { UserRole } from '@/types/enums';

/** Display identity of a message's sender or recipient. */
export interface MessageParticipant {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
}

// Mailbox message (Req 10 inbox/sent), mirroring backend dto.MessageResponse.
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;

  /** At most one of these; `body` is then an optional caption. */
  image_url?: string;
  file_url?: string;
  file_name?: string;
  gif_url?: string;

  /** Withdrawn by its sender: both sides see the tombstone, content is gone. */
  deleted?: boolean;
  /** The message this one replies to, quoted above the bubble. */
  reply_to?: MessageQuote;
  reactions?: ReactionSummary[];
  sender?: MessageParticipant;
  recipient?: MessageParticipant;
}

/** The one-line preview shown above a reply. */
export interface MessageQuote {
  id: string;
  sender_id: string;
  body: string;
  deleted: boolean;
}

/** One emoji, summarised across everyone who used it. */
export interface ReactionSummary {
  emoji: string;
  count: number;
  /** True when we are one of them, so a tap toggles it off. */
  mine: boolean;
}

/** Someone the current user may write to. */
export interface MessageRecipient {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  /** An administrator — reachable for support without an existing booking. */
  support: boolean;
}

/** One thread in the messenger sidebar, as returned by /messages/conversations. */
export interface Conversation {
  user: MessageParticipant;
  /** An administrator: reachable for support without a booking. */
  support: boolean;
  last_message: Message;
  unread_count: number;
}

export interface SendMessageRequest {
  recipient_id: string;
  subject: string;
  body: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  gif_url?: string;
  reply_to_id?: string;
}

/** A stored upload, ready to be attached to a message. */
export interface Attachment {
  url: string;
  name: string;
  /** "image" renders inline; "file" renders as a download row. */
  kind: 'image' | 'file';
  size: number;
}
