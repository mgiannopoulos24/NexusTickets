import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import MyBookingsPage from '@/pages/bookings/MyBookingsPage';
import { EVENT_ID, booking } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

let api: MockFetch;

const inTenMinutes = () => new Date(Date.now() + 10 * 60_000).toISOString();

const withEvent = {
  event: {
    id: EVENT_ID,
    organizer_id: 'org-1',
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

  it('links each booking to a message to its organizer (§10)', async () => {
    api.on('/bookings/me', () => [booking({ ...withEvent })]);
    renderWithProviders(<MyBookingsPage />);

    const link = await screen.findByRole('link', { name: /Μήνυμα στον διοργανωτή/ });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('/messages?compose=1');
    expect(href).toContain('to=org-1');
    expect(href).toContain(`event=${EVENT_ID}`);
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

  it('lets a pending hold be confirmed from the list', async () => {
    const pending = booking({ ...withEvent, status: 'pending', hold_expires_at: inTenMinutes() });
    api.on('/confirm', () => ({
      ...pending,
      status: 'confirmed',
      confirmed_at: pending.created_at,
    }));
    api.on('/bookings/me', () => [pending]);
    renderWithProviders(<MyBookingsPage />);

    expect(await screen.findByRole('timer')).toHaveTextContent(/9:5\d|10:00/);
    // No messaging until the booking is confirmed.
    expect(screen.queryByRole('link', { name: /Μήνυμα στον διοργανωτή/ })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Επιβεβαίωση' }));
    });
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Η κράτηση επιβεβαιώθηκε'));
    const [call] = api.matching('/bookings/bk-1/confirm');
    expect(call.method).toBe('PATCH');
  });

  it('lets a pending hold be released from the list', async () => {
    const pending = booking({ ...withEvent, status: 'pending', hold_expires_at: inTenMinutes() });
    api.on('/cancel', () => ({ ...pending, status: 'cancelled' }));
    api.on('/bookings/me', () => [pending]);
    renderWithProviders(<MyBookingsPage />);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Αποδέσμευση θέσεων' }));
    });
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Οι θέσεις αποδεσμεύτηκαν'));
    expect(api.matching('/bookings/bk-1/cancel')[0].method).toBe('PATCH');
  });

  it("shows the server's reason when a hold cannot be confirmed", async () => {
    const pending = booking({ ...withEvent, status: 'pending', hold_expires_at: inTenMinutes() });
    api.fail('/confirm', 422, 'booking hold has expired');
    api.on('/bookings/me', () => [pending]);
    renderWithProviders(<MyBookingsPage />);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Επιβεβαίωση' }));
    });
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('booking hold has expired'));
  });

  it('offers no actions on a hold that has run out', async () => {
    api.on('/bookings/me', () => [
      booking({
        ...withEvent,
        status: 'pending',
        hold_expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
    ]);
    renderWithProviders(<MyBookingsPage />);

    expect(await screen.findByText('Η δέσμευση των θέσεων έληξε')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Επιβεβαίωση' })).not.toBeInTheDocument();
  });

  it('keeps messaging open for a confirmed booking cancelled with its event', async () => {
    api.on('/bookings/me', () => [
      booking({
        ...withEvent,
        status: 'cancelled',
        confirmed_at: '2026-02-01T00:00:00Z',
        event: { ...withEvent.event, status: 'cancelled' },
      }),
    ]);
    renderWithProviders(<MyBookingsPage />);
    expect(await screen.findByRole('link', { name: /Μήνυμα στον διοργανωτή/ })).toBeInTheDocument();
  });
});
