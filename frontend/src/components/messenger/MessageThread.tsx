import { useEffect, useRef } from 'react';
import { ArrowLeft, CornerUpLeft, Download, FileText, SmilePlus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Message, MessageParticipant } from '@/types/message';

import { avatarClass, displayName, initials, roleLabel } from './participant';
import { clockTime, dayLabel, isNewDay } from './timeFormat';
import { TypingIndicator } from './TypingIndicator';

type MessageThreadProps = {
  participant: MessageParticipant;
  support: boolean;
  messages: Message[];
  currentUserId: string;
  isLoading: boolean;
  /** True while the other side is composing. */
  isTyping: boolean;
  onBack: () => void;
  onDelete: (id: string) => void;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
};

/** The quick-pick row; any emoji from the picker still works via the API. */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

/**
 * A subject repeated on every message would be noise, so it is shown only when
 * it changes — which keeps §10's subject visible without breaking the flow of
 * a conversation.
 */
function subjectFor(message: Message, previous: Message | undefined): string | null {
  const subject = message.subject?.trim();
  if (!subject) return null;
  const previousSubject = previous?.subject?.trim();
  if (previousSubject === subject) return null;
  // A reply that only prefixes "Απ:" is the same topic.
  if (previousSubject && `Απ: ${previousSubject}` === subject) return null;
  if (previousSubject && previousSubject === `Απ: ${subject}`) return null;
  return subject;
}

export function MessageThread({
  participant,
  support,
  messages,
  currentUserId,
  isLoading,
  isTyping,
  onBack,
  onDelete,
  onReply,
  onReact,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  // Jump to the newest message when the thread changes, and follow along as new
  // ones arrive.
  useEffect(() => {
    const behavior = lastCount.current === 0 ? 'auto' : 'smooth';
    lastCount.current = messages.length;
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, [messages, participant.id, isTyping]);

  useEffect(() => {
    lastCount.current = 0;
  }, [participant.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="md:hidden"
          onClick={onBack}
          aria-label="Πίσω στις συνομιλίες"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            avatarClass(participant.id),
          )}
          aria-hidden
        >
          {initials(participant)}
        </span>
        <div className="min-w-0">
          <p className="comfortaa-bold truncate text-sm font-bold text-neutral-900">
            {displayName(participant)}
          </p>
          <p className="comfortaa-regular truncate text-xs text-neutral-500">
            {roleLabel(participant, support)}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 px-4 py-4">
        {isLoading ? (
          <p className="comfortaa-regular text-center text-sm text-neutral-500">Φόρτωση…</p>
        ) : messages.length === 0 ? (
          <p className="comfortaa-regular mt-8 text-center text-sm text-neutral-500">
            Δεν υπάρχουν μηνύματα ακόμη. Γράψτε το πρώτο.
          </p>
        ) : (
          <ol className="space-y-1" aria-label="Μηνύματα συνομιλίας">
            {messages.map((m, i) => {
              const previous = messages[i - 1];
              const mine = m.sender_id === currentUserId;
              const subject = subjectFor(m, previous);
              // Consecutive messages from the same person sit closer together.
              const grouped = previous?.sender_id === m.sender_id && !subject;

              return (
                <li key={m.id}>
                  {isNewDay(previous?.created_at, m.created_at) && (
                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-neutral-200" />
                      <span className="comfortaa-regular text-[11px] font-medium text-neutral-500">
                        {dayLabel(m.created_at)}
                      </span>
                      <span className="h-px flex-1 bg-neutral-200" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'group flex items-end gap-2',
                      grouped ? 'mt-0.5' : 'mt-3',
                      mine ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {!mine && (
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                          grouped ? 'invisible' : avatarClass(participant.id),
                        )}
                        aria-hidden
                      >
                        {initials(participant)}
                      </span>
                    )}

                    <div
                      className={cn(
                        'max-w-[min(32rem,78%)] rounded-2xl px-3.5 py-2 shadow-sm',
                        m.deleted
                          ? 'rounded-bl-md border border-dashed border-neutral-300 bg-neutral-100 text-neutral-500'
                          : mine
                            ? 'rounded-br-md bg-[#6d28d9] text-white'
                            : 'rounded-bl-md border border-neutral-200 bg-white text-neutral-900',
                        m.deleted && mine && 'rounded-br-md rounded-bl-2xl',
                      )}
                    >
                      {m.reply_to && !m.deleted && (
                        <blockquote
                          className={cn(
                            'mb-1.5 border-l-2 pl-2 text-xs',
                            mine
                              ? 'border-violet-300 text-violet-100'
                              : 'border-neutral-300 text-neutral-500',
                          )}
                        >
                          <span className="comfortaa-bold block font-bold">
                            {m.reply_to.sender_id === currentUserId
                              ? 'Εσείς'
                              : displayName(participant)}
                          </span>
                          <span className="comfortaa-regular line-clamp-2 break-words">
                            {m.reply_to.deleted ? 'Το μήνυμα διαγράφηκε' : m.reply_to.body}
                          </span>
                        </blockquote>
                      )}
                      {subject && (
                        <p
                          className={cn(
                            'comfortaa-bold mb-1 text-[11px] font-bold tracking-wide uppercase',
                            mine ? 'text-violet-200' : 'text-neutral-500',
                          )}
                        >
                          {subject}
                        </p>
                      )}
                      {m.deleted && (
                        <p className="comfortaa-regular text-sm italic">
                          Το μήνυμα διαγράφηκε
                        </p>
                      )}

                      {!m.deleted && m.gif_url && (
                        <img
                          src={m.gif_url}
                          alt="GIF"
                          loading="lazy"
                          className="mb-1 max-w-full rounded-lg"
                        />
                      )}

                      {!m.deleted && m.image_url && (
                        <a
                          href={m.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={m.image_url}
                            alt={m.file_name || 'Συνημμένη εικόνα'}
                            loading="lazy"
                            className="mb-1 max-h-72 max-w-full rounded-lg object-cover"
                          />
                        </a>
                      )}

                      {!m.deleted && m.file_url && (
                        <a
                          href={m.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={m.file_name}
                          className={cn(
                            'mb-1 flex items-center gap-2 rounded-lg p-2 transition-colors',
                            mine ? 'bg-white/15 hover:bg-white/25' : 'bg-neutral-100 hover:bg-neutral-200',
                          )}
                        >
                          <FileText className="size-5 shrink-0" aria-hidden />
                          <span className="comfortaa-regular min-w-0 flex-1 truncate text-sm font-medium">
                            {m.file_name || 'Αρχείο'}
                          </span>
                          <Download className="size-4 shrink-0 opacity-70" aria-hidden />
                        </a>
                      )}

                      {!m.deleted && m.body && (
                        <p className="comfortaa-regular text-sm whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                      )}
                      <p
                        className={cn(
                          'comfortaa-regular mt-1 flex items-center justify-end gap-1 text-[10px]',
                          mine ? 'text-violet-200' : 'text-neutral-400',
                        )}
                      >
                        <time dateTime={m.created_at}>{clockTime(m.created_at)}</time>
                        {mine && <span aria-hidden>{m.read_at ? '✓✓' : '✓'}</span>}
                        {mine && (
                          <span className="sr-only">
                            {m.read_at ? 'Αναγνωσμένο' : 'Απεσταλμένο'}
                          </span>
                        )}
                      </p>

                      {!m.deleted && (m.reactions?.length ?? 0) > 0 && (
                        <ul className="mt-1 flex flex-wrap gap-1">
                          {m.reactions?.map((r) => (
                            <li key={r.emoji}>
                              <button
                                type="button"
                                onClick={() => onReact(m.id, r.emoji)}
                                aria-pressed={r.mine}
                                aria-label={`${r.emoji} ${r.count}`}
                                className={cn(
                                  'comfortaa-regular flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors',
                                  r.mine
                                    ? 'border-[#6d28d9] bg-[#6d28d9]/10 text-[#6d28d9]'
                                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
                                )}
                              >
                                <span aria-hidden>{r.emoji}</span>
                                <span>{r.count}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {!m.deleted && (
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              aria-label="Αντίδραση"
                            >
                              <SmilePlus className="size-3.5 text-neutral-400" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="top" align="center" className="w-auto p-1">
                            <ul className="flex gap-0.5">
                              {QUICK_REACTIONS.map((emoji) => (
                                <li key={emoji}>
                                  <button
                                    type="button"
                                    onClick={() => onReact(m.id, emoji)}
                                    aria-label={`Αντίδραση ${emoji}`}
                                    className="rounded-md px-1.5 py-1 text-lg transition-colors hover:bg-neutral-100"
                                  >
                                    {emoji}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </PopoverContent>
                        </Popover>

                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onReply(m)}
                          aria-label="Απάντηση στο μήνυμα"
                        >
                          <CornerUpLeft className="size-3.5 text-neutral-400" />
                        </Button>

                        {mine && (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => onDelete(m.id)}
                            aria-label="Διαγραφή μηνύματος"
                          >
                            <Trash2 className="size-3.5 text-neutral-400" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {isTyping && (
          <div className="mt-3 flex items-end gap-2">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                avatarClass(participant.id),
              )}
              aria-hidden
            >
              {initials(participant)}
            </span>
            <span className="rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-3.5 py-3 shadow-sm">
              <TypingIndicator />
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
