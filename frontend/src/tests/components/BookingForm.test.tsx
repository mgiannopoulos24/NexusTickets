import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { BookingForm } from '@/components/bookings/BookingForm';
import { EVENT_ID, event, ticketType } from '@/tests/helpers/fixtures';
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

  it('asks for confirmation before sending anything', async () => {
    renderWithProviders(<BookingForm event={event()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    expect(await screen.findByText('Επιβεβαίωση Κράτησης')).toBeInTheDocument();
    expect(api.matching('/bookings')).toHaveLength(0);
  });

  it('repeats the ticket, quantity and total in the confirmation dialog', async () => {
    renderWithProviders(<BookingForm event={event()} />);
    await act(async () => {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Κανονικό x 2');
    expect(dialog).toHaveTextContent('Σύνολο: 40.00 €');
  });

  it('posts the selected ticket type and quantity on confirm', async () => {
    api.on('/bookings', () => ({ id: 'bk-1' }));
    renderWithProviders(<BookingForm event={event()} />);

    await act(async () => {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Επιβεβαίωση & Κράτηση' }));
    });

    await waitFor(() =>
      expect(api.matching('/bookings').filter((c) => c.method === 'POST')).toHaveLength(1),
    );
    const [call] = api.matching('/bookings').filter((c) => c.method === 'POST');
    expect(call.body).toEqual({ event_id: EVENT_ID, ticket_type_id: 'tt-1', quantity: 2 });
    expect(toasts.success).toHaveBeenCalled();
  });

  it('surfaces a rejected booking as an error toast', async () => {
    api.fail('/bookings', 409, 'capacity exceeded');
    renderWithProviders(<BookingForm event={event()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Επιβεβαίωση & Κράτηση' }));
    });

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('caps the quantity box at what is still available', () => {
    renderWithProviders(
      <BookingForm event={event({ ticket_types: [ticketType({ available: 5 })] })} />,
    );
    expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '5');
  });
});
