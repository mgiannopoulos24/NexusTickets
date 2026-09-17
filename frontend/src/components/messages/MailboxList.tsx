import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { displayName } from '@/components/messages/participant';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/helpers/formatDate';
import { cn } from '@/lib/utils';
import type { MailboxFolder, MailboxPage } from '@/types/message';
import { useLang } from '@/contexts/langContextCore';

type MailboxListProps = {
  folder: MailboxFolder;
  page: MailboxPage;
  /** Builds the link that opens a message, so the folder and page survive. */
  hrefFor: (messageId: string) => string;
  onPageChange: (nextOffset: number) => void;
};

/**
 * One folder as a table (assignment §10): who, subject, when — with unread
 * inbox rows in bold and a dot, and a pager under it.
 */
export function MailboxList({ folder, page, hrefFor, onPageChange }: MailboxListProps) {
  const { t } = useLang();
  const { messages, total, limit, offset } = page;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + messages.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="comfortaa-regular bg-neutral-50 text-xs font-semibold text-neutral-600">
            <tr>
              <th scope="col" className="w-8 px-3 py-3">
                <span className="sr-only">{t('messages.list.status')}</span>
              </th>
              <th scope="col" className="w-48 px-3 py-3">
                {folder === 'inbox' ? t('messages.view.from') : t('messages.view.to')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('messages.list.subject')}
              </th>
              <th scope="col" className="w-40 px-3 py-3">
                {t('messages.list.date')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {messages.map((m) => {
              const unread = folder === 'inbox' && m.read_at === null;
              const other = folder === 'inbox' ? m.sender : m.recipient;
              return (
                <tr
                  key={m.id}
                  data-testid="mailbox-row"
                  data-unread={unread ? 'true' : undefined}
                  className={cn('hover:bg-violet-50/60', unread && 'bg-violet-50/30')}
                >
                  <td className="px-3 py-3 align-middle">
                    {unread ? (
                      <span
                        className="block size-2.5 rounded-full bg-[var(--nexus-purple)]"
                        role="img"
                        aria-label={t('messages.list.newMessage')}
                      />
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      'comfortaa-regular truncate px-3 py-3 text-neutral-800',
                      unread && 'font-semibold text-neutral-950',
                    )}
                  >
                    {displayName(other)}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      to={hrefFor(m.id)}
                      className={cn(
                        'comfortaa-regular block truncate text-neutral-800 hover:text-[var(--nexus-purple)] hover:underline',
                        unread && 'font-semibold text-neutral-950',
                      )}
                    >
                      {m.subject}
                    </Link>
                    {m.event ? (
                      <span className="comfortaa-regular mt-0.5 block truncate text-xs text-neutral-500">
                        {t('messages.list.event', { title: m.event.title })}
                      </span>
                    ) : null}
                  </td>
                  <td className="comfortaa-regular whitespace-nowrap px-3 py-3 text-xs text-neutral-600">
                    <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
                  </td>
                </tr>
              );
            })}
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
            disabled={!hasPrev}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            aria-label={t('common.previousPage')}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasNext}
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
