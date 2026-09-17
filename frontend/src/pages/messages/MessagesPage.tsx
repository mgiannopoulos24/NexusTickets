import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Inbox, PenSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useAppSelector } from '@/app/hooks';
import {
  useDeleteMessageMutation,
  useGetMessageQuery,
  useListMailboxQuery,
} from '@/app/messagesApi';
import {
  ComposeMessageDialog,
  type ComposeDraft,
} from '@/components/messages/ComposeMessageDialog';
import { MailboxList } from '@/components/messages/MailboxList';
import { MessageView } from '@/components/messages/MessageView';
import { replySubject } from '@/components/messages/participant';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MailboxFolder } from '@/types/message';
import { useLang } from '@/contexts/langContextCore';

const PAGE_SIZE = 20;

function parseFolder(raw: string | null): MailboxFolder {
  return raw === 'sent' ? 'sent' : 'inbox';
}

function parseOffset(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Snap to a page boundary so a hand-edited URL still lands on a real page.
  return Math.floor(n / PAGE_SIZE) * PAGE_SIZE;
}

/**
 * The mailbox of assignment §10. Everything the page shows lives in the URL
 * (`folder`, `offset`, `id`, and the compose intent), so folders, pages and
 * opened messages can be linked to and the back button steps between them.
 */
export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLang();
  const unreadCount = useAppSelector((s) => s.messaging.unreadCount);

  const folder = parseFolder(searchParams.get('folder'));
  const offset = parseOffset(searchParams.get('offset'));
  const openId = searchParams.get('id');
  const composeOpen = searchParams.get('compose') === '1';

  const composeDraft = useMemo<ComposeDraft>(
    () => ({
      recipientId: searchParams.get('to') ?? undefined,
      subject: searchParams.get('subject') ?? undefined,
      eventId: searchParams.get('event') ?? undefined,
    }),
    [searchParams],
  );

  const {
    data: page,
    isLoading: pageLoading,
    isFetching: pageFetching,
    error: pageError,
    refetch: refetchPage,
  } = useListMailboxQuery({ folder, limit: PAGE_SIZE, offset }, { skip: Boolean(openId) });

  const {
    data: message,
    isLoading: messageLoading,
    error: messageError,
  } = useGetMessageQuery(openId ?? '', { skip: !openId });

  const [deleteMessage, { isLoading: deleting }] = useDeleteMessageMutation();

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const folderHref = (target: MailboxFolder) => `/messages?folder=${target}`;
  const messageHref = (id: string) =>
    `/messages?folder=${folder}${offset ? `&offset=${offset}` : ''}&id=${encodeURIComponent(id)}`;
  const listHref = `/messages?folder=${folder}${offset ? `&offset=${offset}` : ''}`;

  const openCompose = (draft: ComposeDraft = {}) =>
    update((next) => {
      next.set('compose', '1');
      for (const [key, value] of [
        ['to', draft.recipientId],
        ['subject', draft.subject],
        ['event', draft.eventId],
      ] as const) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
    });

  const closeCompose = () =>
    update((next) => {
      for (const key of ['compose', 'to', 'subject', 'event']) next.delete(key);
    });

  const onSent = () =>
    update((next) => {
      for (const key of ['compose', 'to', 'subject', 'event', 'id', 'offset']) {
        next.delete(key);
      }
      next.set('folder', 'sent');
    });

  const onDelete = async () => {
    if (!openId) return;
    try {
      await deleteMessage({ id: openId, folder }).unwrap();
      toast.success(t('messages.deleted'));
      update((next) => next.delete('id'));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('messages.deleteFailed')));
    }
  };

  const folders: { key: MailboxFolder; label: string; icon: typeof Inbox; badge?: number }[] = [
    { key: 'inbox', label: t('messages.inbox'), icon: Inbox, badge: unreadCount },
    { key: 'sent', label: t('messages.sent'), icon: Send },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="comfortaa-bold text-2xl font-bold text-neutral-900">
              {t('messages.title')}
            </h1>
            <p className="comfortaa-regular mt-1 text-sm text-neutral-600">
              {t('messages.subtitle')}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => openCompose()}
            className="comfortaa-regular bg-[var(--nexus-purple)] text-white hover:bg-violet-700"
          >
            <PenSquare className="mr-1 size-4" />
            {t('messages.new')}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
          <nav aria-label={t('messages.folders')} className="flex gap-2 md:flex-col">
            {folders.map(({ key, label, icon: Icon, badge }) => {
              const active = key === folder;
              return (
                <Link
                  key={key}
                  to={folderHref(key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'comfortaa-regular flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm md:flex-none',
                    active
                      ? 'border-[var(--nexus-purple)] bg-white font-semibold text-[var(--nexus-purple)]'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  {badge ? (
                    <span
                      className="rounded-full bg-[var(--nexus-purple)] px-2 py-0.5 text-[11px] font-semibold text-white"
                      aria-label={t('messages.unreadBadge', { count: badge })}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <section aria-live="polite">
            {openId ? (
              messageLoading ? (
                <SkeletonList rows={3} />
              ) : messageError || !message ? (
                <ErrorMessage
                  message={apiErrorMessage(messageError, t('messages.notFound'))}
                  onRetry={() => update((next) => next.delete('id'))}
                />
              ) : (
                <MessageView
                  folder={folder}
                  message={message}
                  backHref={listHref}
                  deleting={deleting}
                  onDelete={onDelete}
                  onReply={
                    folder === 'inbox'
                      ? () =>
                          openCompose({
                            recipientId: message.sender_id,
                            subject: replySubject(message.subject),
                            eventId: message.event_id ?? undefined,
                          })
                      : undefined
                  }
                />
              )
            ) : pageLoading ? (
              <SkeletonList rows={6} />
            ) : pageError ? (
              <ErrorMessage
                message={apiErrorMessage(pageError, t('messages.loadError'))}
                onRetry={() => void refetchPage()}
              />
            ) : !page || page.total === 0 ? (
              <EmptyState
                icon={folder === 'inbox' ? Inbox : Send}
                title={folder === 'inbox' ? t('messages.emptyInbox') : t('messages.emptySent')}
                description={
                  folder === 'inbox' ? t('messages.emptyInboxBody') : t('messages.emptySentBody')
                }
              />
            ) : (
              <div className={cn(pageFetching && 'opacity-70 transition-opacity')}>
                <MailboxList
                  folder={folder}
                  page={page}
                  hrefFor={messageHref}
                  onPageChange={(nextOffset) =>
                    update((next) => {
                      if (nextOffset > 0) next.set('offset', String(nextOffset));
                      else next.delete('offset');
                    })
                  }
                />
              </div>
            )}
          </section>
        </div>
      </div>

      <ComposeMessageDialog
        open={composeOpen}
        draft={composeDraft}
        onClose={closeCompose}
        onSent={onSent}
      />
    </div>
  );
}
