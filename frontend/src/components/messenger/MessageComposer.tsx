import { useRef, useState } from 'react';
import { CornerUpLeft, FileText, Loader2, Paperclip, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Attachment, Message } from '@/types/message';

import { EmojiPickerButton } from './EmojiPickerButton';
import { GifPickerButton } from './GifPickerButton';
import { insertAtCaret } from './insertAtCaret';

export type OutgoingMessage = {
  subject: string;
  body: string;
  attachment?: Attachment;
  gifUrl?: string;
  replyToId?: string;
};

type MessageComposerProps = {
  /** Suggested subject: the thread's topic, or empty for a brand-new thread. */
  defaultSubject: string;
  /** A first message has to name its topic; a reply inherits it. */
  requireSubject: boolean;
  disabled: boolean;
  isSending: boolean;
  error: string | null;
  onSend: (message: OutgoingMessage) => void;
  /** Called as the user types, so the other side can show the dots. */
  onTyping?: () => void;
  onUpload: (file: File) => Promise<Attachment>;
  /** The message being quoted, if the user hit reply. */
  replyTo: Message | null;
  onCancelReply: () => void;
};

const TYPING_PING_MS = 2500;

export function MessageComposer({
  defaultSubject,
  requireSubject,
  disabled,
  isSending,
  error,
  onSend,
  onTyping,
  onUpload,
  replyTo,
  onCancelReply,
}: MessageComposerProps) {
  // The subject follows the thread until the user types their own, so switching
  // conversations does not carry a stale topic over.
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingPing = useRef(0);

  const subject = subjectOverride ?? defaultSubject;
  const setSubject = (value: string) => setSubjectOverride(value);

  const canSend = !disabled && !isSending && !isUploading && (body.trim() !== '' || !!attachment);

  const reset = () => {
    setBody('');
    setSubjectOverride(null);
    setAttachment(null);
    setUploadError(null);
    onCancelReply();
  };

  const submit = () => {
    if (!canSend) return;
    onSend({
      subject: subject.trim(),
      body: body.trim(),
      attachment: attachment ?? undefined,
      replyToId: replyTo?.id,
    });
    reset();
    bodyRef.current?.focus();
  };

  /** A GIF is its own message — it goes out immediately, like every messenger. */
  const sendGif = (gifUrl: string) => {
    if (disabled || isSending) return;
    onSend({ subject: subject.trim(), body: body.trim(), gifUrl, replyToId: replyTo?.id });
    reset();
  };

  const insertEmoji = (emoji: string) => {
    const input = bodyRef.current;
    if (!input) {
      setBody((current) => current + emoji);
      return;
    }
    // Drop it where the caret is rather than always at the end.
    const start = input.selectionStart ?? body.length;
    const end = input.selectionEnd ?? start;
    const { text, caret } = insertAtCaret(body, start, end, emoji);
    setBody(text);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  };

  const upload = async (file: File | null | undefined) => {
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      setAttachment(await onUpload(file));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Η μεταφόρτωση απέτυχε.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTyping = () => {
    if (!onTyping) return;
    // One hint every few seconds is enough to keep the dots alive.
    const now = Date.now();
    if (now - lastTypingPing.current < TYPING_PING_MS) return;
    lastTypingPing.current = now;
    onTyping();
  };

  return (
    <form
      className="border-t border-neutral-200 bg-white px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {requireSubject && (
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Θέμα"
          aria-label="Θέμα"
          maxLength={200}
          disabled={disabled}
          className="mb-2"
        />
      )}

      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-[#6d28d9] bg-neutral-50 p-2">
          <CornerUpLeft className="mt-0.5 size-4 shrink-0 text-[#6d28d9]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="comfortaa-bold text-xs font-bold text-neutral-700">Απάντηση σε</p>
            <p className="comfortaa-regular truncate text-xs text-neutral-500">
              {replyTo.deleted
                ? 'Το μήνυμα διαγράφηκε'
                : replyTo.body ||
                  (replyTo.image_url
                    ? '📷 Φωτογραφία'
                    : replyTo.gif_url
                      ? 'GIF'
                      : replyTo.file_name
                        ? `📎 ${replyTo.file_name}`
                        : '')}
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onCancelReply}
            aria-label="Ακύρωση απάντησης"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {(attachment || isUploading) && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
          {isUploading ? (
            <>
              <Loader2 className="size-5 animate-spin text-neutral-500" aria-hidden />
              <p className="comfortaa-regular text-sm text-neutral-600">Μεταφόρτωση…</p>
            </>
          ) : attachment ? (
            <>
              {attachment.kind === 'image' ? (
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="size-14 rounded object-cover"
                />
              ) : (
                <span className="flex size-14 items-center justify-center rounded bg-neutral-200">
                  <FileText className="size-6 text-neutral-600" aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="comfortaa-regular block truncate text-sm font-medium text-neutral-900">
                  {attachment.name}
                </span>
                <span className="comfortaa-regular block text-xs text-neutral-500">
                  {(attachment.size / 1024).toFixed(0)} KB
                </span>
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setAttachment(null)}
                aria-label="Αφαίρεση συνημμένου"
              >
                <X className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      )}

      <div className="flex items-end gap-1">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled || isUploading || !!attachment}
          onClick={() => fileRef.current?.click()}
          aria-label="Επισύναψη αρχείου"
        >
          <Paperclip className="size-5 text-neutral-500" />
        </Button>

        <EmojiPickerButton onSelect={insertEmoji} disabled={disabled} />
        <GifPickerButton onSelect={sendGif} disabled={disabled || isSending} />

        <Textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            handleTyping();
          }}
          // Enter sends, Shift+Enter breaks the line — what a messenger does.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            const file = e.clipboardData.files[0];
            if (file) {
              e.preventDefault();
              void upload(file);
            }
          }}
          placeholder="Γράψτε ένα μήνυμα…"
          aria-label="Μήνυμα"
          rows={1}
          maxLength={4000}
          disabled={disabled}
          className="max-h-40 min-h-10 flex-1 resize-none py-2"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label="Αποστολή"
          className="rounded-full bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
        >
          {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>

      {(error || uploadError) && (
        <p role="alert" className="comfortaa-regular mt-2 text-sm text-[var(--nexus-red)]">
          {uploadError ?? error}
        </p>
      )}
    </form>
  );
}
