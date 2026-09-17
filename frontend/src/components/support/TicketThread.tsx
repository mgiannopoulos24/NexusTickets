import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useCloseTicketMutation, useReplyToTicketMutation } from '@/app/supportApi';
import { TICKET_STATUS_CLASS, ticketStatusLabel } from '@/components/support/ticketStatus';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/helpers/formatDate';
import { cn } from '@/lib/utils';
import type { SupportThread } from '@/types/support';
import { useLang } from '@/contexts/langContextCore';

type TicketThreadProps = {
  thread: SupportThread;
  backHref: string;
  /** The reader is an administrator: replies land as "answered". */
  asAdmin: boolean;
};

/** One ticket's conversation with the reply box and the close action. */
export function TicketThread({ thread, backHref, asAdmin }: TicketThreadProps) {
  const { t } = useLang();
  const { ticket, messages } = thread;
  const [reply, { isLoading: replying }] = useReplyToTicketMutation();
  const [close, { isLoading: closing }] = useCloseTicketMutation();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const closed = ticket.status === 'closed';

  const submit = async () => {
    setError(null);
    if (!body.trim()) {
      setError(t('support.thread.writeSomething'));
      return;
    }
    try {
      await reply({ id: ticket.id, body: body.trim() }).unwrap();
      setBody('');
      toast.success(t('support.thread.replied'));
    } catch (err) {
      setError(apiErrorMessage(err, t('support.thread.sendFailed')));
    }
  };

  const onClose = async () => {
    try {
      await close(ticket.id).unwrap();
      toast.success(t('support.thread.closed'));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('support.thread.closeFailed')));
    }
  };

  return (
    <article className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <Link
          to={backHref}
          className="comfortaa-regular inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-[var(--nexus-purple)]"
        >
          <ArrowLeft className="size-4" />
          {asAdmin ? t('support.thread.backAdmin') : t('support.thread.backMine')}
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'comfortaa-regular rounded-full px-2 py-0.5 text-xs font-medium',
              TICKET_STATUS_CLASS[ticket.status],
            )}
          >
            {ticketStatusLabel(ticket.status)}
          </span>
          {!closed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={closing}
              onClick={() => void onClose()}
              className="comfortaa-regular"
            >
              <CheckCircle2 className="mr-1 size-4" />
              {t('support.thread.close')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-4">
        <h2 className="comfortaa-bold text-xl font-bold text-neutral-950">{ticket.subject}</h2>
        <p className="comfortaa-regular mt-1 text-xs text-neutral-500">
          {ticket.user ? `${ticket.user.full_name.trim() || ticket.user.username} · ` : ''}
          <time dateTime={ticket.created_at}>{formatDateTime(ticket.created_at)}</time>
        </p>

        <ol className="mt-5 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              data-testid="ticket-message"
              className={cn(
                'rounded-lg border px-3 py-2',
                m.from_admin
                  ? 'border-violet-200 bg-violet-50/60'
                  : 'border-neutral-200 bg-neutral-50',
              )}
            >
              <p className="comfortaa-regular text-xs text-neutral-500">
                {m.from_admin
                  ? t('support.thread.supportAuthor')
                  : m.author?.full_name?.trim() || m.author?.username}
                {' · '}
                <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
              </p>
              <p className="comfortaa-regular mt-1 whitespace-pre-wrap text-sm text-neutral-900">
                {m.body}
              </p>
            </li>
          ))}
        </ol>

        {closed ? (
          <p className="comfortaa-regular mt-5 text-sm text-neutral-500">
            {t('support.thread.isClosed')}
          </p>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label htmlFor="ticket-reply" className="comfortaa-regular text-sm text-neutral-700">
              {t('support.thread.reply')}
            </label>
            <Textarea
              id="ticket-reply"
              value={body}
              rows={4}
              maxLength={10000}
              onChange={(e) => setBody(e.target.value)}
              className="comfortaa-regular"
            />
            {error ? (
              <p role="alert" className="comfortaa-regular text-sm text-[var(--nexus-red)]">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={replying}
                className="comfortaa-regular bg-[var(--nexus-purple)] text-white hover:bg-violet-700"
              >
                {replying ? t('support.sending') : t('support.send')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
