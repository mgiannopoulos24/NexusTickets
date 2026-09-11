import type { TicketType } from '@/types/models';
import { tr } from '@/lib/i18n';

/**
 * A ticket type as edited in a form.
 *
 * `id` is the crucial part on an existing event: sending it back tells the API
 * to update that row in place, so bookings keep pointing at it and the seats
 * already sold are preserved. A row with no `id` is a new ticket type.
 */
export type TicketTypeDraft = {
  /** Stable key for React; not sent to the API. */
  key: string;
  /** Server id, absent for rows added in this session. */
  id?: string;
  name: string;
  price: string;
  quantity: string;
  /** Seats already sold on this row; 0 for new rows. Read-only. */
  sold: number;
};

let draftCounter = 0;
function nextKey(): string {
  draftCounter += 1;
  return `new-${draftCounter}`;
}

export function ticketTypesToDrafts(ticketTypes: TicketType[]): TicketTypeDraft[] {
  return ticketTypes.map((t) => ({
    key: t.id,
    id: t.id,
    name: t.name,
    price: String(t.price),
    quantity: String(t.quantity),
    sold: Math.max(0, t.quantity - t.available),
  }));
}

export function emptyTicketDraft(): TicketTypeDraft {
  return { key: nextKey(), name: '', price: '0', quantity: '0', sold: 0 };
}

export type ParsedTicketType = {
  id?: string;
  name: string;
  price: number;
  quantity: number;
};

/**
 * Validates the drafts and converts them to the API payload shape. Returns an
 * error message instead of throwing, so callers can show it inline.
 */
export function parseTicketDrafts(
  drafts: TicketTypeDraft[],
  capacity: number,
): { tickets: ParsedTicketType[] } | { error: string } {
  if (drafts.length === 0) {
    return { error: tr('ticketTypes.atLeastOne') };
  }

  const tickets: ParsedTicketType[] = [];
  for (const d of drafts) {
    const name = d.name.trim();
    const price = Number.parseFloat(d.price.replace(',', '.'));
    const quantity = Number.parseInt(d.quantity.trim(), 10);

    if (name === '') return { error: tr('ticketTypes.nameRequired') };
    if (!Number.isFinite(price) || price < 0) {
      return { error: tr('ticketTypes.invalidPrice', { name }) };
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      return { error: tr('ticketTypes.invalidQuantity', { name }) };
    }
    if (quantity < d.sold) {
      return {
        error: tr('ticketTypes.belowSold', { name, sold: d.sold }),
      };
    }

    tickets.push({ id: d.id, name, price, quantity });
  }

  const sum = tickets.reduce((acc, t) => acc + t.quantity, 0);
  if (sum > capacity) {
    return {
      error: tr('ticketTypes.exceedsCapacity', { sum, capacity }),
    };
  }

  return { tickets };
}
