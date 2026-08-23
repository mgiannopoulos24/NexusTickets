import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';

import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { ConversationList } from '@/components/messenger/ConversationList';
import { MessageComposer } from '@/components/messenger/MessageComposer';
import { MessageThread } from '@/components/messenger/MessageThread';
import { NewConversationDialog } from '@/components/messenger/NewConversationDialog';
import {
  useDeleteMessageMutation,
  useListConversationsQuery,
  useListRecipientsQuery,
  useListThreadQuery,
  useReactToMessageMutation,
  useSendMessageMutation,
  useUploadAttachmentMutation,
} from '@/app/messagesApi';
import { useAppSelector } from '@/app/hooks';
import { useAuth } from '@/hooks/useAuth';
import { sendTypingHint, useTypingSignal } from '@/hooks/useTypingSignal';
import { cn } from '@/lib/utils';
import type { Attachment, Message, MessageParticipant, MessageRecipient } from '@/types/message';
import type { OutgoingMessage } from '@/components/messenger/MessageComposer';

const BOOKING_RULE = 'messaging requires a booking between the two users';

function errorText(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'data' in err) {
    const data = (err as { data?: { error?: { message?: string } } }).data;
    const message = data?.error?.message;
    if (message === BOOKING_RULE) {
      return 'Μπορείτε να στείλετε μήνυμα μόνο σε διοργανωτές των εκδηλώσεων που κρατήσατε (ή στην υποστήριξη).';
    }
    if (message) return message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function recipientToParticipant(r: MessageRecipient): MessageParticipant {
  return { id: r.id, username: r.username, full_name: r.full_name, role: r.role };
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    data: conversations,
    isLoading: conversationsLoading,
    error: conversationsError,
    refetch: refetchConversations,
  } = useListConversationsQuery();
  const { data: recipients } = useListRecipientsQuery();
  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [uploadAttachment] = useUploadAttachmentMutation();
  const [reactToMessage] = useReactToMessageMutation();

  const [query, setQuery] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pickerOpened, setPickerOpened] = useState(false);
  const [pickerDismissed, setPickerDismissed] = useState(false);

  // The footer links here with ?compose=1 (and ?support=1 to reach an
  // administrator). Both intents are read straight off the URL rather than
  // copied into state by an effect.
  const composeRequested = searchParams.get('compose') === '1';
  const supportRequested = searchParams.get('support') === '1';

  const supportContact = useMemo(() => recipients?.find((r) => r.support), [recipients]);

  // The open thread lives in the URL, so a conversation can be linked to and
  // the back button steps between them. A support link resolves to the
  // administrator as soon as the recipient list has loaded.
  const activeUserId =
    searchParams.get('to') ?? (supportRequested ? (supportContact?.id ?? null) : null);

  const isPickerOpen =
    !pickerDismissed && (pickerOpened || (composeRequested && !supportRequested));

  const openThread = (userId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('to', userId);
    next.delete('compose');
    next.delete('support');
    setSearchParams(next, { replace: true });
    setSendError(null);
    setReplyTo(null);
    setPickerOpened(false);
    setPickerDismissed(true);
  };

  const closeThread = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('to');
    next.delete('support');
    setSearchParams(next, { replace: true });
  };

  const openPicker = () => {
    setPickerDismissed(false);
    setPickerOpened(true);
  };

  const {
    data: threadMessages,
    isLoading: threadLoading,
    error: threadError,
  } = useListThreadQuery({ userId: activeUserId ?? '' }, { skip: !activeUserId });

  // Typing hints are transient: they expire on their own if the other side
  // stops without sending anything.
  const typingBy = useAppSelector((state) => state.messaging.typingBy);
  const isTyping = useTypingSignal(activeUserId ? typingBy[activeUserId] : undefined);
  const notifyTyping = useCallback(() => {
    if (activeUserId) sendTypingHint(activeUserId);
  }, [activeUserId]);

  const activeConversation = useMemo(
    () => conversations?.find((c) => c.user.id === activeUserId),
    [conversations, activeUserId],
  );

  // A thread opened from the picker has no conversation row yet, so fall back
  // to the recipient list for the header identity.
  const activeRecipient = useMemo(
    () => recipients?.find((r) => r.id === activeUserId),
    [recipients, activeUserId],
  );

  const activeParticipant: MessageParticipant | null =
    activeConversation?.user ?? (activeRecipient ? recipientToParticipant(activeRecipient) : null);
  const activeSupport = activeConversation?.support ?? activeRecipient?.support ?? false;

  const visibleConversations = useMemo(() => {
    const list = conversations ?? [];
    const q = query.trim().toLocaleLowerCase('el-GR');
    if (!q) return list;
    return list.filter((c) =>
      `${c.user.full_name} ${c.user.username} ${c.last_message.body}`
        .toLocaleLowerCase('el-GR')
        .includes(q),
    );
  }, [conversations, query]);

  // Replies inherit the thread's topic; only a brand-new thread asks for one.
  const lastSubject = threadMessages?.[threadMessages.length - 1]?.subject?.trim() ?? '';
  const hasThread = (threadMessages?.length ?? 0) > 0;
  const defaultSubject = hasThread
    ? lastSubject.startsWith('Απ:')
      ? lastSubject
      : `Απ: ${lastSubject}`
    : '';

  const handleSend = async ({ subject, body, attachment, gifUrl, replyToId }: OutgoingMessage) => {
    if (!activeUserId) return;
    setSendError(null);
    const finalSubject = subject || defaultSubject || 'Μήνυμα';
    try {
      await sendMessage({
        recipient_id: activeUserId,
        subject: finalSubject,
        body,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
        ...(gifUrl ? { gif_url: gifUrl } : {}),
        ...(attachment?.kind === 'image' ? { image_url: attachment.url } : {}),
        ...(attachment?.kind === 'file'
          ? { file_url: attachment.url, file_name: attachment.name }
          : {}),
      }).unwrap();
    } catch (err) {
      setSendError(errorText(err, 'Η αποστολή απέτυχε.'));
    }
  };

  const handleUpload = async (file: File): Promise<Attachment> => {
    try {
      return await uploadAttachment(file).unwrap();
    } catch (err) {
      throw new Error(errorText(err, 'Η μεταφόρτωση απέτυχε.'), { cause: err });
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeUserId) return;
    try {
      await deleteMessage({ id, peerId: activeUserId }).unwrap();
      // Both sides keep a tombstone, so say what actually happened.
      toast.success('Το μήνυμα αποσύρθηκε και για τους δύο.');
      if (replyTo?.id === id) setReplyTo(null);
    } catch (err) {
      toast.error(errorText(err, 'Η διαγραφή απέτυχε.'));
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!activeUserId) return;
    try {
      await reactToMessage({ messageId, emoji, peerId: activeUserId }).unwrap();
    } catch (err) {
      toast.error(errorText(err, 'Η αντίδραση απέτυχε.'));
    }
  };

  if (conversationsError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorMessage
          message={errorText(conversationsError, 'Δεν ήταν δυνατή η φόρτωση των μηνυμάτων.')}
          onRetry={() => void refetchConversations()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-0 py-0 sm:px-4 sm:py-6">
      <div className="flex h-[calc(100dvh-4rem)] overflow-hidden border-neutral-200 bg-white sm:h-[calc(100dvh-9rem)] sm:rounded-xl sm:border sm:shadow-sm">
        {/* Sidebar: full width on a phone until a thread is opened. */}
        <aside
          className={cn(
            'w-full shrink-0 border-neutral-200 md:w-80 md:border-r lg:w-96',
            activeUserId ? 'hidden md:block' : 'block',
          )}
        >
          <ConversationList
            conversations={visibleConversations}
            activeUserId={activeUserId}
            query={query}
            onQueryChange={setQuery}
            onSelect={openThread}
            onCompose={openPicker}
            isLoading={conversationsLoading}
          />
        </aside>

        <section className={cn('min-w-0 flex-1', activeUserId ? 'block' : 'hidden md:block')}>
          {activeParticipant ? (
            <div className="flex h-full min-h-0 flex-col">
              <MessageThread
                participant={activeParticipant}
                support={activeSupport}
                messages={threadMessages ?? []}
                currentUserId={user?.id ?? ''}
                isLoading={threadLoading}
                isTyping={isTyping}
                onBack={closeThread}
                onDelete={handleDelete}
                onReply={setReplyTo}
                onReact={handleReact}
              />
              <MessageComposer
                defaultSubject={defaultSubject}
                requireSubject={!hasThread}
                disabled={!activeUserId}
                isSending={isSending}
                error={
                  sendError ??
                  (threadError
                    ? errorText(threadError, 'Δεν ήταν δυνατή η φόρτωση της συνομιλίας.')
                    : null)
                }
                onSend={handleSend}
                onTyping={notifyTyping}
                onUpload={handleUpload}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <MessagesSquare className="size-12 text-neutral-300" aria-hidden />
              <h2 className="comfortaa-bold mt-4 text-lg font-bold text-neutral-900">
                Επιλέξτε μια συνομιλία
              </h2>
              <p className="comfortaa-regular mt-1 max-w-sm text-sm text-neutral-600">
                Διαλέξτε κάποιον από τη λίστα ή ξεκινήστε νέα συνομιλία με διοργανωτή εκδήλωσης που
                κρατήσατε.
              </p>
            </div>
          )}
        </section>
      </div>

      <NewConversationDialog
        open={isPickerOpen}
        onOpenChange={(open) => {
          setPickerOpened(open);
          setPickerDismissed(!open);
          if (!open && composeRequested) {
            const next = new URLSearchParams(searchParams);
            next.delete('compose');
            next.delete('support');
            setSearchParams(next, { replace: true });
          }
        }}
        recipients={recipients ?? []}
        onPick={openThread}
      />
    </div>
  );
}
