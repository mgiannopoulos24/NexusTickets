import { useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useNotifyAttendeesMutation } from '@/app/messagesApi';
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
import { tr } from '@/lib/i18n';

type NotifyAttendeesDialogProps = {
  open: boolean;
  eventId: string;
  eventTitle: string;
  onClose: () => void;
};

/**
 * The organizer's notice to everyone who booked the event (assignment §10).
 * One message per attendee lands in their inbox, sent in the organizer's name.
 */
export function NotifyAttendeesDialog({
  open,
  eventId,
  eventTitle,
  onClose,
}: NotifyAttendeesDialogProps) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="comfortaa-bold">{t('notify.title')}</DialogTitle>
          <DialogDescription className="comfortaa-regular">
            {t('notify.hint', { title: eventTitle })}
          </DialogDescription>
        </DialogHeader>
        {/* Unmounts with the dialog, so each opening starts from a fresh form. */}
        <NotifyForm eventId={eventId} eventTitle={eventTitle} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

type NotifyFormProps = Omit<NotifyAttendeesDialogProps, 'open'>;

function NotifyForm({ eventId, eventTitle, onClose }: NotifyFormProps) {
  const { t } = useLang();
  const [notify, { isLoading }] = useNotifyAttendeesMutation();
  const [subject, setSubject] = useState(() => tr('notify.defaultSubject', { title: eventTitle }));
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError(t('notify.fillIn'));
      return;
    }
    try {
      const { recipients } = await notify({
        event_id: eventId,
        subject: subject.trim(),
        body: body.trim(),
      }).unwrap();
      toast.success(t('notify.sent', { count: recipients }));
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, t('notify.sendFailed')));
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
        <Label htmlFor="notify-subject" className="comfortaa-regular">
          {t('notify.subject')}
        </Label>
        <Input
          id="notify-subject"
          value={subject}
          maxLength={200}
          onChange={(e) => setSubject(e.target.value)}
          className="comfortaa-regular"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notify-body" className="comfortaa-regular">
          {t('notify.body')}
        </Label>
        <Textarea
          id="notify-body"
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
          {t('notify.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="comfortaa-regular bg-[var(--nexus-purple)] text-white hover:bg-violet-700"
        >
          {isLoading ? t('notify.sending') : t('notify.sendAll')}
        </Button>
      </DialogFooter>
    </form>
  );
}
