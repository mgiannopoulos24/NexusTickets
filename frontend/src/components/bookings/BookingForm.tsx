import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLang } from '@/contexts/langContextCore';
import { cn } from '@/lib/utils';

import { apiErrorMessage } from '@/app/apiEnvelope';
import {
  useCancelBookingMutation,
  useConfirmBookingMutation,
  useCreateBookingMutation,
} from '@/app/bookingsApi';
import { formatCountdown, useHoldCountdown } from '@/hooks/useHoldCountdown';
import type { Booking, Event } from '@/types/models';

// Built per locale so validation messages follow the language switch.
function makeSchema(t: (key: string) => string) {
  return z.object({
    ticket_type_id: z.string().min(1, t('booking.selectType')),
    quantity: z.number().min(1, t('booking.minQuantity')),
  });
}

type BookingFormValues = z.infer<ReturnType<typeof makeSchema>>;

interface BookingFormProps {
  event: Event;
}

export function BookingForm({ event }: BookingFormProps) {
  const { t } = useLang();
  const bookingSchema = useMemo(() => makeSchema(t), [t]);
  const [createBooking, { isLoading }] = useCreateBookingMutation();
  const [confirmBooking, { isLoading: isConfirming }] = useConfirmBookingMutation();
  const [cancelBooking] = useCancelBookingMutation();
  // The pending booking holding the seats while the dialog asks to confirm.
  const [hold, setHold] = useState<Booking | null>(null);
  const secondsLeft = useHoldCountdown(hold?.hold_expires_at);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      // The first ticket type is preselected, so the total reflects it from
      // the start rather than sitting at 0 until the user picks one.
      ticket_type_id: event.ticket_types[0]?.id ?? '',
      quantity: 1,
    },
  });

  const selectedTicketId = watch('ticket_type_id');
  const quantity = watch('quantity');

  const selectedTicket = event.ticket_types.find((tt) => tt.id === selectedTicketId);
  const quantityForTotal = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const totalCost = selectedTicket ? selectedTicket.price * quantityForTotal : 0;

  // Submitting holds the seats as a PENDING booking and opens the
  // confirmation step. §9 requires an explicit confirmation that cannot be
  // undone afterwards; until then the user can still back out, and the seats
  // go back on sale.
  const onSubmit = async () => {
    try {
      const pending = await createBooking({
        event_id: event.id,
        ticket_type_id: selectedTicketId,
        quantity,
      }).unwrap();
      setHold(pending);
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, t('booking.error')));
    }
  };

  const handleConfirm = async () => {
    if (!hold) return;
    try {
      await confirmBooking(hold.id).unwrap();
      toast.success(t('booking.success'));
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, t('booking.error')));
    } finally {
      setHold(null);
    }
  };

  // Backing out releases the seats now rather than when the hold lapses.
  // Failure is harmless: the server releases the hold once it expires.
  const releaseHold = () => {
    if (!hold) return;
    void cancelBooking(hold.id);
    setHold(null);
  };

  useEffect(() => {
    if (hold && secondsLeft === 0) {
      void cancelBooking(hold.id);
      setHold(null);
      toast.error(t('booking.expired'));
    }
  }, [hold, secondsLeft, cancelBooking, t]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="comfortaa-regular text-sm font-medium">{t('booking.ticketType')}</legend>
        {/* One card per ticket type, chosen with a click: a radio group in
            disguise, so it stays keyboard- and screen-reader-friendly. */}
        <div role="radiogroup" aria-label={t('booking.ticketType')} className="grid gap-2">
          {event.ticket_types.map((tt) => {
            const selected = tt.id === selectedTicketId;
            const exhausted = tt.available <= 0;
            return (
              <button
                key={tt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={exhausted}
                data-testid="ticket-type-option"
                onClick={() =>
                  setValue('ticket_type_id', tt.id, { shouldValidate: true, shouldDirty: true })
                }
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl border-2 bg-white px-4 py-3 text-left transition',
                  selected
                    ? 'border-nexus-coral bg-orange-50/60 shadow-sm'
                    : 'border-neutral-200 hover:border-neutral-300',
                  exhausted && 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                      selected
                        ? 'border-nexus-coral bg-nexus-coral text-white'
                        : 'border-neutral-300',
                    )}
                  >
                    {selected ? <Check className="size-3" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="comfortaa-regular block truncate font-medium text-neutral-900">
                      {tt.name}
                    </span>
                    <span className="comfortaa-regular block text-xs text-neutral-500">
                      {t('booking.availableCount', { available: tt.available })}
                    </span>
                  </span>
                </span>
                <span className="comfortaa-bold shrink-0 text-lg font-semibold text-nexus-navy">
                  {tt.price.toFixed(2)} €
                </span>
              </button>
            );
          })}
        </div>
        {errors.ticket_type_id && (
          <p className="comfortaa-regular text-xs text-[var(--nexus-red)]">
            {errors.ticket_type_id.message}
          </p>
        )}
      </fieldset>

      <div className="space-y-2 sm:max-w-[12rem]">
        <Label htmlFor="booking-quantity" className="comfortaa-regular">
          {t('booking.quantity')}
        </Label>
        <Input
          id="booking-quantity"
          type="number"
          {...register('quantity', { valueAsNumber: true })}
          className="comfortaa-regular"
          min={1}
          max={selectedTicket?.available ?? 1}
        />
        {errors.quantity && (
          <p className="comfortaa-regular text-xs text-[var(--nexus-red)]">
            {errors.quantity.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
        <span className="comfortaa-regular text-sm font-medium text-neutral-600">
          {t('booking.total')}
        </span>
        <span className="comfortaa-bold text-xl font-bold text-nexus-navy">
          {totalCost.toFixed(2)} €
        </span>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="comfortaa-regular w-full bg-nexus-coral text-white hover:bg-nexus-coral-dark"
      >
        {isLoading ? t('booking.processing') : t('booking.submit')}
      </Button>

      <Dialog
        open={hold !== null}
        onOpenChange={(open) => {
          if (!open) releaseHold();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="comfortaa-bold">{t('booking.confirmTitle')}</DialogTitle>
            <DialogDescription className="comfortaa-regular">
              {t('booking.confirmBody')}
            </DialogDescription>
          </DialogHeader>
          <div className="comfortaa-regular space-y-2 py-4 text-sm">
            <p>
              <strong>{t('booking.event')}</strong> {event.title}
            </p>
            <p>
              <strong>{t('booking.ticket')}</strong>{' '}
              {hold?.ticket_type?.name ?? selectedTicket?.name} x {hold?.quantity ?? quantity}
            </p>
            <p className="comfortaa-bold text-lg font-bold text-[var(--nexus-purple)]">
              {t('booking.totalLabel', { total: (hold?.total_cost ?? totalCost).toFixed(2) })}
            </p>
            {secondsLeft !== null && (
              <p className="text-amber-700" role="timer" aria-live="off">
                {t('booking.holdCountdown', { time: formatCountdown(secondsLeft) })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={releaseHold}
              disabled={isConfirming}
              className="comfortaa-regular"
            >
              {t('booking.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming}
              className="comfortaa-regular bg-nexus-coral text-white hover:bg-nexus-coral-dark"
            >
              {t('booking.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
