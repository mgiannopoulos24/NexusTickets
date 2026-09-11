import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { TICKET_STATUS_CLASS, ticketStatusLabel } from '@/components/support/ticketStatus';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/helpers/formatDate';
import { cn } from '@/lib/utils';
import type { SupportTicketPage } from '@/types/support';
import { useLang } from '@/contexts/langContext';

type TicketListProps = {
  page: SupportTicketPage;
  hrefFor: (ticketId: string) => string;
  /** Admin view: show who opened each ticket. */
  showOwner?: boolean;
  onPageChange: (nextOffset: number) => void;
};

export function TicketList({ page, hrefFor, showOwner = false, onPageChange }: TicketListProps) {
  const { t } = useLang();
  const { tickets, total, limit, offset } = page;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + tickets.length, total);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="comfortaa-regular bg-neutral-50 text-xs font-semibold text-neutral-600">
            <tr>
              <th scope="col" className="px-3 py-3">
                {t('support.list.subject')}
              </th>
              {showOwner ? (
                <th scope="col" className="w-44 px-3 py-3">
                  {t('support.list.user')}
                </th>
              ) : null}
              <th scope="col" className="w-32 px-3 py-3">
                {t('support.list.status')}
              </th>
              <th scope="col" className="w-40 px-3 py-3">
                {t('support.list.lastActivity')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {tickets.map((t) => (
              <tr key={t.id} data-testid="ticket-row" className="hover:bg-violet-50/60">
                <td className="px-3 py-3">
                  <Link
                    to={hrefFor(t.id)}
                    className="comfortaa-regular block truncate font-medium text-neutral-900 hover:text-[var(--nexus-purple)] hover:underline"
                  >
                    {t.subject}
                  </Link>
                </td>
                {showOwner ? (
                  <td className="comfortaa-regular truncate px-3 py-3 text-neutral-700">
                    {t.user?.full_name?.trim() || t.user?.username || '—'}
                  </td>
                ) : null}
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'comfortaa-regular inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                      TICKET_STATUS_CLASS[t.status],
                    )}
                  >
                    {ticketStatusLabel(t.status)}
                  </span>
                </td>
                <td className="comfortaa-regular whitespace-nowrap px-3 py-3 text-xs text-neutral-600">
                  <time dateTime={t.updated_at}>{formatDateTime(t.updated_at)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="comfortaa-regular flex items-center justify-between border-t border-neutral-200 px-3 py-2 text-xs text-neutral-600">
        <span>{t('common.rangeOf', { from, to, total })}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offset === 0}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            aria-label={t('common.previousPage')}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => onPageChange(offset + limit)}
            aria-label={t('common.nextPage')}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
