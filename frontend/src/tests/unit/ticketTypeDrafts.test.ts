import { describe, expect, it } from 'vitest';

import {
  emptyTicketDraft,
  parseTicketDrafts,
  ticketTypesToDrafts,
  type TicketTypeDraft,
} from '@/lib/ticketTypeDrafts';
import type { TicketType } from '@/types/models';

function ticketType(overrides: Partial<TicketType> = {}): TicketType {
  return {
    id: 'tt-1',
    name: 'Γενική',
    price: 10,
    quantity: 50,
    available: 50,
    ...overrides,
  };
}

describe('ticketTypesToDrafts', () => {
  it('derives sold seats from quantity minus availability', () => {
    const [draft] = ticketTypesToDrafts([ticketType({ quantity: 50, available: 30 })]);
    expect(draft.sold).toBe(20);
    expect(draft.id).toBe('tt-1');
    expect(draft.quantity).toBe('50');
  });

  it('never reports negative sold seats', () => {
    const [draft] = ticketTypesToDrafts([ticketType({ quantity: 10, available: 20 })]);
    expect(draft.sold).toBe(0);
  });
});

describe('parseTicketDrafts', () => {
  const base: TicketTypeDraft = {
    key: 'k1',
    id: 'tt-1',
    name: 'Γενική',
    price: '10',
    quantity: '50',
    sold: 0,
  };

  it('keeps the server id so the API updates the row in place', () => {
    const result = parseTicketDrafts([base], 100);
    expect('tickets' in result).toBe(true);
    if ('tickets' in result) {
      expect(result.tickets[0].id).toBe('tt-1');
      expect(result.tickets[0].price).toBe(10);
      expect(result.tickets[0].quantity).toBe(50);
    }
  });

  it('omits the id for a newly added row', () => {
    const fresh = { ...emptyTicketDraft(), name: 'VIP', price: '20', quantity: '5' };
    const result = parseTicketDrafts([fresh], 100);
    if ('tickets' in result) {
      expect(result.tickets[0].id).toBeUndefined();
    } else {
      throw new Error(result.error);
    }
  });

  it('accepts a comma as the decimal separator', () => {
    const result = parseTicketDrafts([{ ...base, price: '12,50' }], 100);
    if ('tickets' in result) {
      expect(result.tickets[0].price).toBe(12.5);
    } else {
      throw new Error(result.error);
    }
  });

  it('refuses an empty set — an event needs at least one ticket type', () => {
    const result = parseTicketDrafts([], 100);
    expect('error' in result).toBe(true);
  });

  it('refuses a nameless ticket type', () => {
    const result = parseTicketDrafts([{ ...base, name: '  ' }], 100);
    expect('error' in result).toBe(true);
  });

  it('refuses a negative price', () => {
    const result = parseTicketDrafts([{ ...base, price: '-1' }], 100);
    expect('error' in result).toBe(true);
  });

  it('refuses shrinking a row below what has already been sold', () => {
    // 20 seats are gone; dropping the allocation to 10 would over-sell.
    const result = parseTicketDrafts([{ ...base, sold: 20, quantity: '10' }], 100);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('20');
    }
  });

  it('allows shrinking down to exactly the sold count', () => {
    const result = parseTicketDrafts([{ ...base, sold: 20, quantity: '20' }], 100);
    expect('tickets' in result).toBe(true);
  });

  it('refuses a total allocation above the event capacity', () => {
    const result = parseTicketDrafts(
      [
        { ...base, key: 'a', quantity: '60' },
        { ...base, key: 'b', id: 'tt-2', quantity: '60' },
      ],
      100,
    );
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('120');
    }
  });

  it('allows a total allocation equal to capacity', () => {
    const result = parseTicketDrafts(
      [
        { ...base, key: 'a', quantity: '60' },
        { ...base, key: 'b', id: 'tt-2', quantity: '40' },
      ],
      100,
    );
    expect('tickets' in result).toBe(true);
  });
});
