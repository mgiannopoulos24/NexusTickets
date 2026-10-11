import type { Booking, Category, Event, TicketType } from '@/types/models';

/** The event detail page only fetches when the route param is a UUID. */
export const EVENT_ID = '00000000-0000-0000-0000-0000000000e1';

export function ticketType(over: Partial<TicketType> = {}): TicketType {
  return { id: 'tt-1', name: 'Κανονικό', price: 20, quantity: 100, available: 100, ...over };
}

export function event(over: Partial<Event> = {}): Event {
  return {
    id: EVENT_ID,
    organizer_id: 'org-1',
    title: 'Συναυλία Κλασικής Μουσικής',
    description: 'Μια βραδιά κλασικής μουσικής.',
    venue: 'Μέγαρο Μουσικής',
    event_type: 'concert',
    featured_image_url: null,
    address: null,
    city: 'Αθήνα',
    country: 'GR',
    latitude: null,
    longitude: null,
    start_at: '2099-10-10T19:00:00Z',
    end_at: '2099-10-10T21:30:00Z',
    capacity: 300,
    status: 'published',
    categories: ['Μουσική'],
    ticket_types: [ticketType(), ticketType({ id: 'tt-2', name: 'Φοιτητικό', price: 12 })],
    photos: [],
    tickets_sold: 0,
    tickets_remaining: 200,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

export function category(over: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Μουσική', ...over };
}

/** A confirmed booking carries its confirmation time, as the API sends it. */
export function booking(over: Partial<Booking> = {}): Booking {
  const b: Booking = {
    id: 'bk-1',
    user_id: 'u-1',
    event_id: EVENT_ID,
    ticket_type_id: 'tt-1',
    quantity: 2,
    total_cost: 40,
    status: 'confirmed',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...over,
  };
  if (b.status === 'confirmed' && !('confirmed_at' in over)) b.confirmed_at = b.created_at;
  return b;
}
