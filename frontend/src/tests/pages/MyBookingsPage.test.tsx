import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import MyBookingsPage from '@/pages/bookings/MyBookingsPage';
import { EVENT_ID, booking } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';

let api: MockFetch;

const withEvent = {
  event: {
    id: EVENT_ID,
    title: 'Συναυλία Κλασικής Μουσικής',
    venue: 'Μέγαρο Μουσικής',
    city: 'Αθήνα',
    start_at: '2099-10-10T19:00:00Z',
    end_at: '2099-10-10T21:30:00Z',
    status: 'published' as const,
  },
  ticket_type: { id: 'tt-1', name: 'Κανονικό', price: 20 },
};

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  signIn({ role: 'attendee' });
  api = mockFetch();
});

describe('MyBookingsPage (§11)', () => {
  it('lists a booking with its event, quantity, status and total', async () => {
    api.on('/bookings/me', () => [booking({ ...withEvent })]);
    renderWithProviders(<MyBookingsPage />);

    expect(await screen.findByText('Συναυλία Κλασικής Μουσικής')).toBeInTheDocument();
    expect(screen.getByText('Κανονικό')).toBeInTheDocument();
    expect(screen.getByText('Επιβεβαιωμένη')).toBeInTheDocument();
    expect(screen.getByText('40.00 €')).toBeInTheDocument();
  });

  it('flags a booking whose event was cancelled (§10)', async () => {
    api.on('/bookings/me', () => [
      booking({ ...withEvent, event: { ...withEvent.event, status: 'cancelled' } }),
    ]);
    renderWithProviders(<MyBookingsPage />);
    expect(await screen.findByText('Η εκδήλωση ακυρώθηκε')).toBeInTheDocument();
  });

  it('invites the user to browse when there is nothing yet', async () => {
    api.on('/bookings/me', () => []);
    renderWithProviders(<MyBookingsPage />);
    expect(await screen.findByText('Δεν έχετε κρατήσεις ακόμα')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Αναζητήστε εκδηλώσεις' })).toHaveAttribute(
      'href',
      '/events',
    );
  });

  it('reports a failed load', async () => {
    api.fail('/bookings/me', 500, 'boom');
    renderWithProviders(<MyBookingsPage />);
    expect(await screen.findByRole('button', { name: /Δοκιμ|Retry/i })).toBeInTheDocument();
  });
});
