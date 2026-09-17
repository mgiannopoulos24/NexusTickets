import { useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useListRecipientsQuery, useSendMessageMutation } from '@/app/messagesApi';
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
import type { MessageRecipient } from '@/types/message';
import { useLang } from '@/contexts/langContextCore';
import { tr } from '@/lib/i18n';

const BOOKING_RULE = 'messaging requires a booking between the two users';

export type ComposeDraft = {
  /** Preselected recipient, when the dialog opened from a reply or a booking. */
  recipientId?: string;
  subject?: string;
  eventId?: string;
};

type ComposeMessageDialogProps = {
  open: boolean;
  draft: ComposeDraft;
  onClose: () => void;
  onSent: () => void;
};

function recipientLabel(r: MessageRecipient): string {
  const name = r.full_name.trim() || r.username;
  return `${name} — ${tr(`role.${r.role}`)}`;
}

/**
 * Compose one message. The recipient list is what the server allows: people
 * the user shares a booking with, plus support (assignment §10).
 */
export function ComposeMessageDialog({ open, draft, onClose, onSent }: ComposeMessageDialogProps) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="comfortaa-bold">{t('messages.compose.title')}</DialogTitle>
          <DialogDescription className="comfortaa-regular">
            {t('messages.compose.hint')}
          </DialogDescription>
        </DialogHeader>
        {/* The content unmounts with the dialog, so the form starts clean from
            the draft on every opening without effects resetting state. */}
        <ComposeForm draft={draft} onClose={onClose} onSent={onSent} />
      </DialogContent>
    </Dialog>
  );
}

type ComposeFormProps = Omit<ComposeMessageDialogProps, 'open'>;

function ComposeForm({ draft, onClose, onSent }: ComposeFormProps) {
  const { t } = useLang();
  const { data: recipients, isLoading: recipientsLoading } = useListRecipientsQuery();

  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();

  // Until the user picks someone, the recipient follows the draft — resolved
  // against the list once it has loaded, since a preselection the server
  // would not allow is worse than none.
  const [chosen, setChosen] = useState<string | null>(null);
  const wanted = draft.recipientId;
  const recipientId = chosen ?? (wanted && recipients?.some((r) => r.id === wanted) ? wanted : '');

  const [subject, setSubject] = useState(draft.subject ?? '');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!recipientId) {
      setError(t('messages.compose.pickRecipient'));
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError(t('messages.compose.fillIn'));
      return;
    }
    try {
      await sendMessage({
        recipient_id: recipientId,
        subject: subject.trim(),
        body: body.trim(),
        ...(draft.eventId ? { event_id: draft.eventId } : {}),
      }).unwrap();
      toast.success(t('messages.compose.sent'));
      onSent();
    } catch (err) {
      const message = apiErrorMessage(err, t('messages.compose.sendFailed'));
      setError(message === BOOKING_RULE ? t('messages.compose.bookingRule') : message);
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
        <Label htmlFor="compose-recipient" className="comfortaa-regular">
          {t('messages.compose.recipient')}
        </Label>
        {/* A native select: it works in every browser and in the test runner,
            and the list is short. */}
        <select
          id="compose-recipient"
          value={recipientId}
          onChange={(e) => setChosen(e.target.value)}
          disabled={recipientsLoading}
          className="comfortaa-regular h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-[var(--nexus-purple)] focus-visible:ring-2 focus-visible:ring-[var(--nexus-purple)]/30 disabled:opacity-50"
        >
          <option value="">
            {recipientsLoading ? t('messages.compose.loading') : t('messages.compose.choose')}
          </option>
          {(recipients ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {recipientLabel(r)}
            </option>
          ))}
        </select>
        {recipients && recipients.length === 0 ? (
          <p className="comfortaa-regular text-xs text-neutral-500">
            {t('messages.compose.noRecipients')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="compose-subject" className="comfortaa-regular">
          {t('messages.compose.subject')}
        </Label>
        <Input
          id="compose-subject"
          value={subject}
          maxLength={200}
          onChange={(e) => setSubject(e.target.value)}
          className="comfortaa-regular"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="compose-body" className="comfortaa-regular">
          {t('messages.compose.body')}
        </Label>
        <Textarea
          id="compose-body"
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
          {t('messages.compose.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={sending}
          className="comfortaa-regular bg-[var(--nexus-purple)] text-white hover:bg-violet-700"
        >
          {sending ? t('messages.compose.sending') : t('messages.compose.send')}
        </Button>
      </DialogFooter>
    </form>
  );
}
