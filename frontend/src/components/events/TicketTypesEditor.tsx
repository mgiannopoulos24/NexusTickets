import { PlusIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type TicketTypeDraft, emptyTicketDraft } from '@/lib/ticketTypeDrafts';
import { useLang } from '@/contexts/langContext';

type Props = {
  drafts: TicketTypeDraft[];
  onChange: (next: TicketTypeDraft[]) => void;
  capacity: number;
  disabled?: boolean;
  className?: string;
};

export function TicketTypesEditor({ drafts, onChange, capacity, disabled, className }: Props) {
  const { t } = useLang();
  const totalSeats = drafts.reduce((acc, d) => {
    const n = Number.parseInt(d.quantity.trim(), 10);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const overCapacity = totalSeats > capacity;

  const update = (key: string, patch: Partial<TicketTypeDraft>) => {
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const remove = (key: string) => {
    onChange(drafts.filter((d) => d.key !== key));
  };

  return (
    <div className={cn('space-y-3', className)}>
      {drafts.map((d) => (
        <div
          key={d.key}
          className="grid grid-cols-[1fr_5.5rem_5.5rem_auto] items-start gap-2 rounded-lg border border-neutral-200 bg-white p-2"
        >
          <div>
            <Input
              aria-label={t('ticketEditor.typeName')}
              placeholder={t('ticketEditor.typeName')}
              value={d.name}
              disabled={disabled}
              onChange={(e) => update(d.key, { name: e.target.value })}
            />
            {d.sold > 0 && (
              <p className="comfortaa-regular mt-1 text-xs text-neutral-500">
                {t(d.sold === 1 ? 'ticketEditor.bookingsOne' : 'ticketEditor.bookingsMany', {
                  count: d.sold,
                })}
              </p>
            )}
          </div>
          <Input
            aria-label={t('ticketEditor.price')}
            inputMode="decimal"
            placeholder={t('ticketEditor.price')}
            value={d.price}
            disabled={disabled}
            onChange={(e) => update(d.key, { price: e.target.value })}
          />
          <Input
            aria-label={t('ticketEditor.seats')}
            inputMode="numeric"
            placeholder={t('ticketEditor.seats')}
            value={d.quantity}
            disabled={disabled}
            onChange={(e) => update(d.key, { quantity: e.target.value })}
          />
          <button
            type="button"
            aria-label={t('ticketEditor.removeType', { name: d.name || t('ticketEditor.ticket') })}
            disabled={disabled || d.sold > 0 || drafts.length === 1}
            onClick={() => remove(d.key)}
            title={
              d.sold > 0
                ? t('ticketEditor.hasBookings')
                : drafts.length === 1
                  ? t('ticketEditor.needOne')
                  : t('ticketEditor.remove')
            }
            className={cn(
              'mt-1 rounded-lg p-2 text-neutral-500 transition-colors',
              'hover:bg-red-50 hover:text-[var(--nexus-red)]',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500',
            )}
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...drafts, emptyTicketDraft()])}
        >
          <PlusIcon className="mr-1 size-4" />
          {t('ticketEditor.add')}
        </Button>
        <p
          className={cn(
            'comfortaa-regular text-xs',
            overCapacity ? 'text-[var(--nexus-red)]' : 'text-neutral-600',
          )}
        >
          {t('ticketEditor.totalSeats', { total: totalSeats, capacity })}
        </p>
      </div>
    </div>
  );
}
