import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { useCreateBookingMutation } from '@/app/bookingsApi';
import type { Event } from '@/types/models';

const bookingSchema = z.object({
  ticket_type_id: z.string().min(1, 'Παρακαλώ επιλέξτε τύπο εισιτηρίου'),
  quantity: z.number().min(1, 'Η ποσότητα πρέπει να είναι τουλάχιστον 1'),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  event: Event;
}

export function BookingForm({ event }: BookingFormProps) {
  const [createBooking, { isLoading }] = useCreateBookingMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  const selectedTicketId = watch('ticket_type_id');
  const quantity = watch('quantity');

  const selectedTicket = event.ticket_types.find((t) => t.id === selectedTicketId);
  const totalCost = selectedTicket ? selectedTicket.price * quantity : 0;

  const onSubmit = (_data: BookingFormValues) => {
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    const selectedTicketId = watch('ticket_type_id');
    const qty = watch('quantity');
    try {
      await createBooking({
        event_id: event.id,
        ticket_type_id: selectedTicketId,
        quantity: qty,
      }).unwrap();
      toast.success('Η κράτηση ολοκληρώθηκε με επιτυχία!');
      setIsConfirmOpen(false);
    } catch (err: unknown) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? 'Παρουσιάστηκε σφάλμα κατά την κράτηση');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="comfortaa-regular">Τύπος Εισιτηρίου</Label>
          <Select
            onValueChange={(value) => setValue('ticket_type_id', value)}
            defaultValue={event.ticket_types[0]?.id}
          >
            <SelectTrigger className="comfortaa-regular">
              <SelectValue placeholder="Επιλογή εισιτηρίου" />
            </SelectTrigger>
            <SelectContent>
              {event.ticket_types.map((tt) => (
                <SelectItem key={tt.id} value={tt.id} className="comfortaa-regular">
                  {tt.name} ({tt.price.toFixed(2)} €) - Διαθέσιμα: {tt.available}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.ticket_type_id && (
            <p className="text-xs text-[var(--nexus-red)] comfortaa-regular">
              {errors.ticket_type_id.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="comfortaa-regular">Ποσότητα</Label>
          <Input
            type="number"
            {...register('quantity', { valueAsNumber: true })}
            className="comfortaa-regular"
            min={1}
            max={selectedTicket?.available ?? 1}
          />
          {errors.quantity && (
            <p className="text-xs text-[var(--nexus-red)] comfortaa-regular">
              {errors.quantity.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
        <span className="text-sm font-medium text-neutral-600 comfortaa-regular">Σύνολο:</span>
        <span className="text-xl font-bold text-[#6d28d9] comfortaa-bold">
          {totalCost.toFixed(2)} €
        </span>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-full bg-[#6d28d9] text-white hover:bg-violet-700 comfortaa-regular"
      >
        {isLoading ? 'Επεξεργασία...' : 'Κράτηση Εισιτηρίων'}
      </Button>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="comfortaa-bold">Επιβεβαίωση Κράτησης</DialogTitle>
            <DialogDescription className="comfortaa-regular">
              Είστε σίγουροι ότι θέλετε να προχωρήσετε στην κράτηση; Η διαδικασία είναι οριστική και
              δεν μπορεί να αναιρεθεί.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-sm comfortaa-regular">
            <p>
              <strong>Εκδήλωση:</strong> {event.title}
            </p>
            <p>
              <strong>Εισιτήριο:</strong> {selectedTicket?.name} x {quantity}
            </p>
            <p className="text-lg font-bold text-[#6d28d9] comfortaa-bold">
              Σύνολο: {totalCost.toFixed(2)} €
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              className="comfortaa-regular"
            >
              Ακύρωση
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-[#6d28d9] text-white hover:bg-violet-700 comfortaa-regular"
            >
              Επιβεβαίωση & Κράτηση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
