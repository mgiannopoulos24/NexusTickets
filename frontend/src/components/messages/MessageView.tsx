import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Reply, Trash2 } from 'lucide-react';

import { displayName, roleLabel } from '@/components/messages/participant';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/helpers/formatDate';
import type { MailboxFolder, Message } from '@/types/message';
import { useLang } from '@/contexts/langContext';

type MessageViewProps = {
  folder: MailboxFolder;
  message: Message;
  backHref: string;
  onReply?: () => void;
  onDelete: () => Promise<void>;
  deleting: boolean;
};

/** One opened message: headers, body, and the reply / delete actions. */
export function MessageView({
  folder,
  message,
  backHref,
  onReply,
  onDelete,
  deleting,
}: MessageViewProps) {
  const { t } = useLang();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const confirmDelete = async () => {
    await onDelete();
    setConfirmOpen(false);
  };

  return (
    <article className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <Link
          to={backHref}
          className="comfortaa-regular inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-[var(--nexus-purple)]"
        >
          <ArrowLeft className="size-4" />
          {folder === 'inbox' ? t('messages.inbox') : t('messages.sent')}
        </Link>
        <div className="flex items-center gap-2">
          {onReply ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReply}
              className="comfortaa-regular"
            >
              <Reply className="mr-1 size-4" />
              {t('messages.view.reply')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="comfortaa-regular text-[var(--nexus-red)] hover:text-[var(--nexus-red)]"
          >
            <Trash2 className="mr-1 size-4" />
            {t('messages.view.delete')}
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        <h2 className="comfortaa-bold text-xl font-bold text-neutral-950">{message.subject}</h2>
        <dl className="comfortaa-regular mt-3 grid gap-1 text-sm text-neutral-700 sm:grid-cols-[6rem_1fr]">
          <dt className="text-neutral-500">{t('messages.view.from')}</dt>
          <dd>
            {displayName(message.sender)}
            {message.sender ? (
              <span className="text-neutral-500"> · {roleLabel(message.sender)}</span>
            ) : null}
          </dd>
          <dt className="text-neutral-500">{t('messages.view.to')}</dt>
          <dd>
            {displayName(message.recipient)}
            {message.recipient ? (
              <span className="text-neutral-500"> · {roleLabel(message.recipient)}</span>
            ) : null}
          </dd>
          <dt className="text-neutral-500">{t('messages.view.date')}</dt>
          <dd>
            <time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
          </dd>
          {message.event ? (
            <>
              <dt className="text-neutral-500">{t('messages.view.event')}</dt>
              <dd>
                <Link
                  to={`/events/${encodeURIComponent(message.event.id)}`}
                  className="text-[var(--nexus-purple)] hover:underline"
                >
                  {message.event.title}
                </Link>
              </dd>
            </>
          ) : null}
        </dl>

        <p className="comfortaa-regular mt-5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
          {message.body}
        </p>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="comfortaa-bold">{t('messages.view.deleteTitle')}</DialogTitle>
            <DialogDescription className="comfortaa-regular">
              {folder === 'inbox'
                ? t('messages.view.deleteBodyInbox')
                : t('messages.view.deleteBodySent')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="comfortaa-regular"
            >
              {t('messages.compose.cancel')}
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={() => void confirmDelete()}
              className="comfortaa-regular bg-[var(--nexus-red)] text-white hover:bg-red-700"
            >
              {deleting ? t('messages.view.deleting') : t('messages.view.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
