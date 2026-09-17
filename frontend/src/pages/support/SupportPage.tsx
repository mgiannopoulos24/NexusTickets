import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LifeBuoy, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useGetTicketQuery, useListMyTicketsQuery, useOpenTicketMutation } from '@/app/supportApi';
import { TicketList } from '@/components/support/TicketList';
import { TicketThread } from '@/components/support/TicketThread';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLang } from '@/contexts/langContextCore';

const PAGE_SIZE = 20;

function parseOffset(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n / PAGE_SIZE) * PAGE_SIZE : 0;
}

/**
 * A user's support requests to the administration: the list, one open
 * ticket's thread (`?id=`), and the "new request" dialog (`?new=1`).
 */
export default function SupportPage() {
  const { t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const offset = parseOffset(searchParams.get('offset'));
  const openId = searchParams.get('id');
  const newOpen = searchParams.get('new') === '1';

  const {
    data: page,
    isLoading,
    error,
    refetch,
  } = useListMyTicketsQuery({ limit: PAGE_SIZE, offset }, { skip: Boolean(openId) });
  const {
    data: thread,
    isLoading: threadLoading,
    error: threadError,
  } = useGetTicketQuery(openId ?? '', { skip: !openId });

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  };
  const listHref = `/support${offset ? `?offset=${offset}` : ''}`;

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="comfortaa-bold text-2xl font-bold text-neutral-900">
              {t('support.title')}
            </h1>
            <p className="comfortaa-regular mt-1 text-sm text-neutral-600">
              {t('support.subtitle')}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => update((next) => next.set('new', '1'))}
            className="comfortaa-regular bg-[var(--nexus-purple)] text-white hover:bg-violet-700"
          >
            <Plus className="mr-1 size-4" />
            {t('support.new')}
          </Button>
        </div>

        {openId ? (
          threadLoading ? (
            <SkeletonList rows={3} />
          ) : threadError || !thread ? (
            <ErrorMessage
              message={apiErrorMessage(threadError, t('support.notFound'))}
              onRetry={() => update((next) => next.delete('id'))}
            />
          ) : (
            <TicketThread thread={thread} backHref={listHref} asAdmin={false} />
          )
        ) : isLoading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorMessage
            message={apiErrorMessage(error, t('support.loadError'))}
            onRetry={() => void refetch()}
          />
        ) : !page || page.total === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title={t('support.emptyTitle')}
            description={t('support.emptyBody')}
          />
        ) : (
          <TicketList
            page={page}
            hrefFor={(id) =>
              `/support?id=${encodeURIComponent(id)}${offset ? `&offset=${offset}` : ''}`
            }
            onPageChange={(next) =>
              update((p) => {
                if (next > 0) p.set('offset', String(next));
                else p.delete('offset');
              })
            }
          />
        )}
      </div>

      <NewTicketDialog
        open={newOpen}
        onClose={() => update((next) => next.delete('new'))}
        onOpened={(id) =>
          update((next) => {
            next.delete('new');
            next.delete('offset');
            next.set('id', id);
          })
        }
      />
    </div>
  );
}

function NewTicketDialog({
  open,
  onClose,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: (id: string) => void;
}) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="comfortaa-bold">{t('support.dialogTitle')}</DialogTitle>
          <DialogDescription className="comfortaa-regular">
            {t('support.dialogHint')}
          </DialogDescription>
        </DialogHeader>
        <NewTicketForm onClose={onClose} onOpened={onOpened} />
      </DialogContent>
    </Dialog>
  );
}

function NewTicketForm({
  onClose,
  onOpened,
}: {
  onClose: () => void;
  onOpened: (id: string) => void;
}) {
  const { t } = useLang();
  const [openTicket, { isLoading }] = useOpenTicketMutation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError(t('support.fillIn'));
      return;
    }
    try {
      const ticket = await openTicket({ subject: subject.trim(), body: body.trim() }).unwrap();
      toast.success(t('support.created'));
      onOpened(ticket.id);
    } catch (err) {
      setError(apiErrorMessage(err, t('support.createFailed')));
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="ticket-subject" className="comfortaa-regular">
          {t('support.subject')}
        </Label>
        <Input
          id="ticket-subject"
          value={subject}
          maxLength={200}
          onChange={(e) => setSubject(e.target.value)}
          className="comfortaa-regular"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-body" className="comfortaa-regular">
          {t('support.description')}
        </Label>
        <Textarea
          id="ticket-body"
          value={body}
          rows={6}
          maxLength={10000}
          onChange={(e) => setBody(e.target.value)}
          className="comfortaa-regular"
        />
      </div>
      {error ? (
        <p role="alert" className="comfortaa-regular text-sm text-[var(--nexus-red)]">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="comfortaa-regular">
          {t('support.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="comfortaa-regular bg-[var(--nexus-purple)] text-white hover:bg-violet-700"
        >
          {isLoading ? t('support.sending') : t('support.send')}
        </Button>
      </DialogFooter>
    </form>
  );
}
