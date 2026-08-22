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
  sender?: MessageParticipant;
  recipient?: MessageParticipant;
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

export interface SendMessageRequest {
  recipient_id: string;
  subject: string;
  body: string;
}
