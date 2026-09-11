import type { UserRole } from '@/types/enums';

export type SupportTicketStatus = 'open' | 'answered' | 'closed';

export interface SupportParticipant {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
}

/** A request from a user to the administration (separate from the mailbox). */
export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: SupportTicketStatus;
  created_at: string;
  updated_at: string;
  user?: SupportParticipant;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
  from_admin: boolean;
  author?: SupportParticipant;
}

export interface SupportThread {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

export interface SupportTicketPage {
  tickets: SupportTicket[];
  total: number;
  limit: number;
  offset: number;
}

export interface SupportCounts {
  open: number;
  answered: number;
  closed: number;
}
