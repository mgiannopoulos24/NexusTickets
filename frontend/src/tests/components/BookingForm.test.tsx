import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { BookingForm } from '@/components/bookings/BookingForm';
import { EVENT_ID, booking, event, ticketType } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  signIn({ role: 'attendee' });
  api = mockFetch();
});

/**
 * Answers the three booking calls. The confirm and cancel routes go first: the
 * stub matches by URL fragment in registration order, and "/bookings" would
 * otherwise catch them too.
 */
function holdRoutes(overrides: Parameters<typeof booking>[0] = {}) {
  const pending = booking({
    id: 'bk-1',
    status: 'pending',
    hold_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    ...overrides,
  });
  api.on('/confirm', () => ({ ...pending, status: 'confirmed', confirmed_at: pending.created_at }));
  api.on('/cancel', () => ({ ...pending, status: 'cancelled' }));
  api.on('/bookings', () => pending);
}

const total = () => screen.getByText('Σύνολο:').parentElement?.textContent ?? '';

describe('BookingForm', () => {
  it('prices the preselected ticket instead of showing 0', () => {
    renderWithProviders(<BookingForm event={event()} />);
    // The first ticket type is shown in the closed Select, so the total has to
    // reflect it before the user touches anything.
    expect(total()).toContain('20.00 €');
  });

  it('multiplies the ticket price by the quantity', async () => {
    renderWithProviders(<BookingForm event={event()} />);
    const qty = screen.getByRole('spinbutton');
    await act(async () => {
      fireEvent.change(qty, { target: { value: '3' } });
    });
    expect(total()).toContain('60.00 €');
  });

  it('falls back to 0 while the quantity box is empty', async () => {
    renderWithProviders(<BookingForm event={event()} />);
    await act(async () => {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    });
    expect(total()).toContain('0.00 €');
  });

  it('shows 0 for an event with no ticket types', () => {
    renderWithProviders(<BookingForm event={event({ ticket_types: [] })} />);
    expect(total()).toContain('0.00 €');
  });

  it('holds the seats, then asks for confirmation', async () => {
    holdRoutes();
    renderWithProviders(<BookingForm event={event()} />);
    await act(async () => {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    expect(await screen.findByText('Επιβεβαίωση Κράτησης')).toBeInTheDocument();

    const posts = api.matching('/bookings').filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ event_id: EVENT_ID, ticket_type_id: 'tt-1', quantity: 2 });
    // Nothing is final until the user confirms.
    expect(api.matching('/confirm')).toHaveLength(0);
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('repeats the held ticket, quantity and total, with the time left', async () => {
    holdRoutes({ quantity: 2, total_cost: 40 });
    renderWithProviders(<BookingForm event={event()} />);
    await act(async () => {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Κανονικό x 2');
    expect(dialog).toHaveTextContent('Σύνολο: 40.00 €');
    expect(within(dialog).getByRole('timer')).toHaveTextContent(
      /Οι θέσεις δεσμεύονται για \d+:\d\d/,
    );
  });

  it('confirms the hold on confirm', async () => {
    holdRoutes();
    renderWithProviders(<BookingForm event={event()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Επιβεβαίωση & Κράτηση' }));
    });

    await waitFor(() => expect(toasts.success).toHaveBeenCalled());
    const [call] = api.matching('/bookings/bk-1/confirm');
    expect(call.method).toBe('PATCH');
    expect(api.matching('/cancel')).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('releases the hold when the user backs out', async () => {
    holdRoutes();
    renderWithProviders(<BookingForm event={event()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Ακύρωση' }));
    });

    await waitFor(() => expect(api.matching('/bookings/bk-1/cancel')).toHaveLength(1));
    expect(api.matching('/bookings/bk-1/cancel')[0].method).toBe('PATCH');
    expect(api.matching('/confirm')).toHaveLength(0);
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('releases a hold that runs out while the dialog is open', async () => {
    holdRoutes({ hold_expires_at: new Date(Date.now() + 1500).toISOString() });
    renderWithProviders(<BookingForm event={event()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await waitFor(() => expect(api.matching('/bookings/bk-1/cancel')).toHaveLength(1), {
      timeout: 4000,
    });
    expect(toasts.error).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('surfaces a rejected hold as an error toast', async () => {
    api.fail('/bookings', 409, 'capacity exceeded');
    renderWithProviders(<BookingForm event={event()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('capacity exceeded'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('reports a confirmation the server refuses', async () => {
    api.fail('/confirm', 422, 'booking hold has expired');
    holdRoutes();
    renderWithProviders(<BookingForm event={event()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Επιβεβαίωση & Κράτηση' }));
    });

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('booking hold has expired'));
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('caps the quantity box at what is still available', () => {
    renderWithProviders(
      <BookingForm event={event({ ticket_types: [ticketType({ available: 5 })] })} />,
    );
    expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '5');
  });
});
