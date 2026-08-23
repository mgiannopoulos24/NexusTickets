import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import EventDetailPage from '@/pages/events/EventDetailPage';
import { EVENT_ID, event, ticketType } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';
import type { Event } from '@/types/models';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  api = mockFetch();
});

async function renderDetail(ev: Partial<Event> = {}) {
  const full = event(ev);
  api.on(`/events/${EVENT_ID}`, () => full);
  renderWithProviders(<EventDetailPage />, { route: `/events/${EVENT_ID}`, path: '/events/:id' });
  await screen.findByText(full.title);
  return full;
}

const bookingForm = () => screen.queryByRole('button', { name: 'Κράτηση Εισιτηρίων' });

describe('EventDetailPage (§9)', () => {
  it('shows the event details and each ticket type with its price', async () => {
    await renderDetail();
    expect(screen.getByText('Μέγαρο Μουσικής', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Κανονικό')).toBeInTheDocument();
    expect(screen.getByText('20.00 €')).toBeInTheDocument();
    expect(screen.getByText('Φοιτητικό')).toBeInTheDocument();
    expect(screen.getByText('12.00 €')).toBeInTheDocument();
  });

  it('tells a visitor to sign in instead of showing the form', async () => {
    await renderDetail();
    expect(bookingForm()).not.toBeInTheDocument();
    expect(screen.getByText('Συνδεθείτε για να κάνετε κράτηση.')).toBeInTheDocument();
  });

  it.each(['attendee', 'organizer', 'admin'] as const)('lets %s book', async (role) => {
    signIn({ role });
    await renderDetail();
    await waitFor(() => expect(bookingForm()).toBeInTheDocument());
  });

  it('refuses a cancelled event', async () => {
    signIn({ role: 'attendee' });
    await renderDetail({ status: 'cancelled' });
    expect(bookingForm()).not.toBeInTheDocument();
    expect(screen.getByText('Η εκδήλωση έχει ακυρωθεί — δεν γίνονται κρατήσεις.')).toBeInTheDocument();
  });

  it('refuses an event that has not been published', async () => {
    signIn({ role: 'attendee' });
    await renderDetail({ status: 'draft' });
    expect(bookingForm()).not.toBeInTheDocument();
    expect(screen.getByText('Η εκδήλωση δεν είναι ακόμη δημοσιευμένη.')).toBeInTheDocument();
  });

  it('refuses an event that has already finished', async () => {
    signIn({ role: 'attendee' });
    await renderDetail({ start_at: '2020-01-01T18:00:00Z', end_at: '2020-01-01T20:00:00Z' });
    expect(bookingForm()).not.toBeInTheDocument();
    expect(screen.getAllByText('Η εκδήλωση έχει ολοκληρωθεί.').length).toBeGreaterThan(0);
  });

  it('refuses a sold-out event (§8: no booking without free seats)', async () => {
    signIn({ role: 'attendee' });
    await renderDetail({
      ticket_types: [ticketType({ available: 0 })],
      tickets_remaining: 0,
    });
    expect(bookingForm()).not.toBeInTheDocument();
    expect(screen.getByText('Τα εισιτήρια εξαντλήθηκαν.')).toBeInTheDocument();
  });

  it('refuses an event with no ticket types', async () => {
    signIn({ role: 'attendee' });
    await renderDetail({ ticket_types: [], tickets_remaining: 0 });
    expect(bookingForm()).not.toBeInTheDocument();
    expect(screen.getAllByText('Δεν υπάρχουν διαθέσιμοι τύποι εισιτηρίων.').length).toBeGreaterThan(0);
  });
});
