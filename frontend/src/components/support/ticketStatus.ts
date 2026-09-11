import type { SupportTicketStatus } from '@/types/support';
import { tr } from '@/lib/i18n';

export function ticketStatusLabel(status: SupportTicketStatus): string {
  return tr(`status.ticket.${status}`);
}

export const TICKET_STATUS_CLASS: Record<SupportTicketStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  answered: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-neutral-200 text-neutral-700',
};
