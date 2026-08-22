import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useDeleteMessageMutation,
  useListMessagesQuery,
  useListRecipientsQuery,
  useSendMessageMutation,
} from '@/app/messagesApi';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Message, MessageRecipient } from '@/types/message';

type Folder = 'inbox' | 'sent';

const PAGE_SIZE = 50;

function errorText(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'data' in err) {
    const data = (err as { data?: { error?: { message?: string } } }).data;
    const message = data?.error?.message;
    if (message === 'messaging requires a booking between the two users') {
      return 'Μπορείτε να στείλετε μήνυμα μόνο σε διοργανωτές των εκδηλώσεων που κρατήσατε (ή στην υποστήριξη).';
    }
    if (message) return message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function participantLabel(r: MessageRecipient): string {
  const name = r.full_name.trim() || r.username;
  if (r.support) return `${name} — Υποστήριξη`;
  if (r.role === 'organizer') return `${name} — Διοργανωτής`;
  return name;
}

/** Who the message is "with", from the current user's point of view. */
function counterparty(m: Message, folder: Folder): string {
  const p = folder === 'inbox' ? m.sender : m.recipient;
  if (!p) return '—';
  return p.full_name.trim() || p.username;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [folder, setFolder] = useState<Folder>('inbox');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: messages,
    isLoading,
    isFetching,
    error: listError,
    refetch,
  } = useListMessagesQuery({ folder, limit: PAGE_SIZE, offset: 0 });

  const { data: recipients } = useListRecipientsQuery();
  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  // Compose state. The footer links here with ?compose=1 (and ?support=1 to
  // preselect an administrator), so a support request is one click away.
  //
  // Those two intents are read straight from the URL rather than copied into
  // state by an effect: the composer is open when the user opened it *or* the
  // link asked for it, and the recipient/subject fall back to the support
  // defaults until the user picks something else.
  const composeRequested = searchParams.get('compose') === '1';
  const supportRequested = searchParams.get('support') === '1';

  const [composeOpened, setComposeOpened] = useState(false);
  const [composeDismissed, setComposeDismissed] = useState(false);
  const [recipientOverride, setRecipientOverride] = useState<string | null>(null);
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [composeError, setComposeError] = useState<string | null>(null);

  const supportContact = useMemo(() => recipients?.find((r) => r.support), [recipients]);

  const isComposing = !composeDismissed && (composeOpened || composeRequested);
  const recipientId = recipientOverride ?? (supportRequested ? (supportContact?.id ?? '') : '');
  const subject = subjectOverride ?? (supportRequested ? 'Αίτημα υποστήριξης' : '');

  const setRecipientId = (v: string) => setRecipientOverride(v);
  const setSubject = (v: string) => setSubjectOverride(v);

  const openCompose = () => {
    setComposeDismissed(false);
    setComposeOpened(true);
  };

  const closeCompose = () => {
    setComposeOpened(false);
    setComposeDismissed(true);
    setComposeError(null);
    setRecipientOverride(null);
    setSubjectOverride(null);
    setBody('');
    if (composeRequested || supportRequested) {
      const next = new URLSearchParams(searchParams);
      next.delete('compose');
      next.delete('support');
      setSearchParams(next, { replace: true });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeError(null);

    if (!recipientId) {
      setComposeError('Επιλέξτε παραλήπτη.');
      return;
    }
    if (subject.trim() === '' || body.trim() === '') {
      setComposeError('Συμπληρώστε θέμα και μήνυμα.');
      return;
    }

    try {
      await sendMessage({ recipient_id: recipientId, subject: subject.trim(), body: body.trim() }).unwrap();
      toast.success('Το μήνυμα στάλθηκε.');
      closeCompose();
      setFolder('sent');
    } catch (err) {
      setComposeError(errorText(err, 'Η αποστολή απέτυχε.'));
    }
  };

  const handleReply = (m: Message) => {
    const other = folder === 'inbox' ? m.sender : m.recipient;
    if (!other) return;
    setRecipientId(other.id);
    setSubject(m.subject.startsWith('Απ:') ? m.subject : `Απ: ${m.subject}`);
    setBody('');
    setComposeError(null);
    openCompose();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage(id).unwrap();
      toast.success('Το μήνυμα διαγράφηκε.');
    } catch (err) {
      toast.error(errorText(err, 'Η διαγραφή απέτυχε.'));
    }
  };

  const isUnread = (m: Message): boolean => folder === 'inbox' && m.read_at === null;
  const canReply = (m: Message): boolean => {
    const other = folder === 'inbox' ? m.sender : m.recipient;
    return !!other && other.id !== user?.id;
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="comfortaa-bold text-2xl font-bold text-neutral-900">Μηνύματα</h1>
            <p className="comfortaa-regular mt-1 text-sm text-neutral-600">
              Επικοινωνία με διοργανωτές και την υποστήριξη.
            </p>
          </div>
          {!isComposing && (
            <Button type="button" onClick={openCompose}>
              Νέο μήνυμα
            </Button>
          )}
        </div>

        {isComposing && (
          <form
            onSubmit={handleSend}
            className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <h2 className="comfortaa-bold mb-4 text-lg text-neutral-900">Νέο μήνυμα</h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="msg-recipient"
                  className="comfortaa-regular mb-1.5 block text-sm font-medium text-neutral-800"
                >
                  Προς <span className="text-[var(--nexus-red)]">*</span>
                </label>
                <select
                  id="msg-recipient"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className={cn(
                    'h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm',
                    'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
                  )}
                >
                  <option value="">Επιλέξτε παραλήπτη…</option>
                  {(recipients ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {participantLabel(r)}
                    </option>
                  ))}
                </select>
                {recipients && recipients.length === 0 && (
                  <p className="comfortaa-regular mt-1.5 text-sm text-neutral-600">
                    Δεν υπάρχουν διαθέσιμοι παραλήπτες ακόμη. Η επικοινωνία με διοργανωτή ανοίγει
                    μετά από κράτηση.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="msg-subject"
                  className="comfortaa-regular mb-1.5 block text-sm font-medium text-neutral-800"
                >
                  Θέμα <span className="text-[var(--nexus-red)]">*</span>
                </label>
                <Input
                  id="msg-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div>
                <label
                  htmlFor="msg-body"
                  className="comfortaa-regular mb-1.5 block text-sm font-medium text-neutral-800"
                >
                  Μήνυμα <span className="text-[var(--nexus-red)]">*</span>
                </label>
                <Textarea
                  id="msg-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  maxLength={4000}
                />
              </div>

              {composeError && <ErrorMessage message={composeError} />}

              <div className="flex gap-2">
                <Button type="submit" disabled={isSending}>
                  {isSending ? 'Αποστολή…' : 'Αποστολή'}
                </Button>
                <Button type="button" variant="outline" onClick={closeCompose} disabled={isSending}>
                  Ακύρωση
                </Button>
              </div>
            </div>
          </form>
        )}

        <div className="mb-4 flex gap-2">
          {(['inbox', 'sent'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFolder(f)}
              aria-pressed={folder === f}
              className={cn(
                'comfortaa-regular rounded-lg px-4 py-2 text-sm transition-colors',
                folder === f
                  ? 'bg-[#6d28d9] text-white'
                  : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
              )}
            >
              {f === 'inbox' ? 'Εισερχόμενα' : 'Απεσταλμένα'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <SkeletonList rows={4} />
        ) : listError ? (
          <ErrorMessage
            message={errorText(listError, 'Σφάλμα φόρτωσης μηνυμάτων.')}
            onRetry={() => void refetch()}
          />
        ) : (messages ?? []).length === 0 ? (
          <EmptyState
            title={folder === 'inbox' ? 'Κανένα εισερχόμενο μήνυμα' : 'Κανένα απεσταλμένο μήνυμα'}
            description={
              folder === 'inbox'
                ? 'Εδώ θα εμφανίζονται τα μηνύματα που λαμβάνετε από διοργανωτές και την υποστήριξη.'
                : 'Τα μηνύματα που στέλνετε θα εμφανίζονται εδώ.'
            }
          />
        ) : (
          <ul className={cn('space-y-2', isFetching && 'opacity-60 transition-opacity')}>
            {(messages ?? []).map((m) => {
              const expanded = expandedId === m.id;
              return (
                <li
                  key={m.id}
                  className={cn(
                    'rounded-xl border bg-white px-4 py-3',
                    isUnread(m) ? 'border-[#6d28d9] bg-[#f5f3ff]' : 'border-neutral-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : m.id)}
                      aria-expanded={expanded}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isUnread(m) && (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#6d28d9]"
                            aria-label="μη αναγνωσμένο"
                          />
                        )}
                        <p className="comfortaa-bold truncate text-sm font-semibold text-neutral-900">
                          {m.subject || '(χωρίς θέμα)'}
                        </p>
                      </div>
                      <p className="comfortaa-regular mt-0.5 text-xs text-neutral-600">
                        {folder === 'inbox' ? 'Από' : 'Προς'}: {counterparty(m, folder)}
                      </p>
                      <p
                        className={cn(
                          'comfortaa-regular mt-1 text-sm text-neutral-700',
                          expanded ? 'whitespace-pre-wrap' : 'line-clamp-2',
                        )}
                      >
                        {m.body}
                      </p>
                      <p className="comfortaa-regular mt-1 text-xs text-neutral-500">
                        {new Date(m.created_at).toLocaleString('el-GR')}
                      </p>
                    </button>

                    <div className="flex shrink-0 flex-col gap-1">
                      {canReply(m) && (
                        <button
                          type="button"
                          onClick={() => handleReply(m)}
                          className="comfortaa-regular rounded-lg px-3 py-1 text-xs text-[#6d28d9] hover:bg-[#f5f3ff]"
                        >
                          Απάντηση
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(m.id)}
                        className="comfortaa-regular rounded-lg px-3 py-1 text-xs text-[var(--nexus-red)] hover:bg-red-50"
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
