import type { UserRole } from '@/types/enums';

/** Display identity of a message's sender or recipient. */
export interface MessageParticipant {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
}

/** The event a message is about, enough to label and link it. */
export interface MessageEventRef {
  id: string;
  title: string;
}

/** One mailbox entry (assignment §10), mirroring backend dto.MessageResponse. */
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  event_id: string | null;
  subject: string;
  body: string;
  /** Null until the recipient opens the message — the "new" indicator. */
  read_at: string | null;
  created_at: string;
  sender?: MessageParticipant;
  recipient?: MessageParticipant;
  event?: MessageEventRef;
}

export type MailboxFolder = 'inbox' | 'sent';

/** One page of a folder plus the folder's size, for the pager. */
export interface MailboxPage {
  messages: Message[];
  total: number;
  limit: number;
  offset: number;
}

/** Someone the current user may write to. */
export interface MessageRecipient {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
}

export interface SendMessageRequest {
  recipient_id: string;
  event_id?: string;
  subject: string;
  body: string;
}

/** An organizer's notice to everyone who booked one of their events. */
export interface NotifyAttendeesRequest {
  event_id: string;
  subject: string;
  body: string;
}
