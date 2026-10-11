import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import OrganizerDashboardPage from '@/pages/organizer/OrganizerDashboardPage';
import OrganizerEventsPage from '@/pages/organizer/OrganizerEventsPage';
import EventBookingsPage from '@/pages/organizer/EventBookingsPage';
import { booking, event, EVENT_ID } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

const ORGANIZER = 'org-1';

let api: MockFetch;

/** The test DOM has no window.confirm, so each test decides the answer. */
function stubConfirm(answer: boolean) {
  const confirm = vi.fn(() => answer);
  vi.stubGlobal('confirm', confirm);
  return confirm;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  api = mockFetch();
  signIn({ id: ORGANIZER, role: 'organizer' });
});

describe('OrganizerDashboardPage', () => {
  it('links to creating an event and to the organizer’s own events', () => {
    renderWithProviders(<OrganizerDashboardPage />, { route: '/organizer' });
    const main = screen.getByRole('heading', { name: 'Πίνακας διοργανωτή' }).parentElement!;
    expect(within(main).getByRole('link', { name: 'Νέα εκδήλωση' })).toHaveAttribute(
      'href',
      '/organizer/events/new',
    );
    expect(within(main).getByRole('link', { name: 'Οι εκδηλώσεις μου' })).toHaveAttribute(
      'href',
      '/organizer/events',
    );
  });
});

describe('OrganizerEventsPage (§7β)', () => {
  const draft = event({ id: 'ev-draft', title: 'Πρόχειρη', status: 'draft', tickets_sold: 0 });
  const sold = event({ id: 'ev-sold', title: 'Με κρατήσεις', tickets_sold: 3 });
  const unsold = event({ id: 'ev-unsold', title: 'Χωρίς κρατήσεις', tickets_sold: 0 });
  const cancelled = event({ id: 'ev-cx', title: 'Ακυρωμένη', status: 'cancelled' });

  const rowOf = async (title: string) => (await screen.findByText(title)).closest('li')!;

  it('lists the organizer’s events with their status and booked seats', async () => {
    api.on('/events/organizer/me', () => [draft, sold]);
    renderWithProviders(<OrganizerEventsPage />, { route: '/organizer/events' });

    const draftRow = await rowOf('Πρόχειρη');
    expect(within(draftRow).getByText('Πρόχειρο')).toBeInTheDocument();
    expect(within(draftRow).getByRole('link', { name: /Πρόχειρη/ })).toHaveAttribute(
      'href',
      '/organizer/events/ev-draft/edit',
    );

    const soldRow = await rowOf('Με κρατήσεις');
    expect(within(soldRow).getByText('Δημοσιευμένο')).toBeInTheDocument();
    expect(within(soldRow).getByRole('link', { name: '3' })).toHaveAttribute(
      'href',
      '/organizer/events/ev-sold/bookings',
    );
  });

  it('offers deletion only before publication or before the first booking (§7γ)', async () => {
    api.on('/events/organizer/me', () => [draft, sold, unsold, cancelled]);
    renderWithProviders(<OrganizerEventsPage />, { route: '/organizer/events' });

    const deleteIn = (row: HTMLElement) => within(row).queryByTitle('Διαγραφή');
    expect(deleteIn(await rowOf('Πρόχειρη'))).toBeInTheDocument();
    expect(deleteIn(await rowOf('Χωρίς κρατήσεις'))).toBeInTheDocument();
    expect(deleteIn(await rowOf('Με κρατήσεις'))).not.toBeInTheDocument();
    expect(deleteIn(await rowOf('Ακυρωμένη'))).not.toBeInTheDocument();
  });

  it('deletes an event after confirmation', async () => {
    api.on('/events/organizer/me', () => [draft]);
    api.on('/events/organizer/ev-draft', () => null);
    const confirm = stubConfirm(true);
    renderWithProviders(<OrganizerEventsPage />, { route: '/organizer/events' });

    fireEvent.click(within(await rowOf('Πρόχειρη')).getByTitle('Διαγραφή'));

    expect(confirm).toHaveBeenCalledWith('Διαγραφή «Πρόχειρη»; Η ενέργεια δεν αναιρείται.');
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Η εκδήλωση διαγράφηκε'));
    expect(api.calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/ev-draft'))).toBe(true);
  });

  it('does nothing when the deletion is not confirmed', async () => {
    api.on('/events/organizer/me', () => [draft]);
    stubConfirm(false);
    renderWithProviders(<OrganizerEventsPage />, { route: '/organizer/events' });

    fireEvent.click(within(await rowOf('Πρόχειρη')).getByTitle('Διαγραφή'));
    expect(api.calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('shows the server’s reason when a deletion is refused', async () => {
    api.on('/events/organizer/me', () => [draft]);
    api.fail(/\/events\/organizer\/ev-draft$/, 409, 'event cannot be deleted after first booking');
    stubConfirm(true);
    renderWithProviders(<OrganizerEventsPage />, { route: '/organizer/events' });

    fireEvent.click(within(await rowOf('Πρόχειρη')).getByTitle('Διαγραφή'));
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith('event cannot be deleted after first booking'),
    );
  });

  it('invites the organizer to create a first event when there are none', async () => {
    api.on('/events/organizer/me', () => []);
    renderWithProviders(<OrganizerEventsPage />, { route: '/organizer/events' });
    expect(await screen.findByText('Δεν υπάρχουν εκδηλώσεις ακόμα')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Δημιουργήστε την πρώτη σας' })).toHaveAttribute(
      'href',
      '/organizer/events/new',
    );
  });
});

describe('EventBookingsPage (§7β, §7δ, §10)', () => {
  const route = `/organizer/events/${EVENT_ID}/bookings`;
  const path = '/organizer/events/:id/bookings';

  const bookings = [
    booking({
      id: 'bk-1',
      quantity: 2,
      total_cost: 40,
      attendee: { id: 'u-1', username: 'maria', full_name: 'Μαρία Παπά', email: 'm@example.com' },
      ticket_type: { id: 'tt-1', name: 'Κανονικό', price: 20 },
    }),
    booking({
      id: 'bk-2',
      quantity: 1,
      total_cost: 12,
      attendee: { id: 'u-2', username: 'nikos', full_name: '', email: 'n@example.com' },
      ticket_type: { id: 'tt-2', name: 'Φοιτητικό', price: 12 },
    }),
  ];

  it('lists who booked, which ticket, how many seats, and totals them', async () => {
    api.on(`/bookings/organizer/events/${EVENT_ID}`, () => bookings);
    api.on(`/events/${EVENT_ID}`, () => event());
    renderWithProviders(<EventBookingsPage />, { route, path });

    expect(
      await screen.findByRole('heading', { name: 'Συναυλία Κλασικής Μουσικής' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Μαρία Παπά')).toBeInTheDocument();
    // A blank full name falls back to the username.
    expect(screen.getByText('nikos')).toBeInTheDocument();
    expect(screen.getByText('Φοιτητικό')).toBeInTheDocument();
    expect(screen.getAllByText('Επιβεβαιωμένη')).toHaveLength(2);
    expect(screen.getByText('2 κρατήσεις · 3 θέσεις · 52.00 € σύνολο')).toBeInTheDocument();
  });

  it('totals only what was sold, not holds pending or abandoned', async () => {
    api.on(`/bookings/organizer/events/${EVENT_ID}`, () => [
      ...bookings,
      booking({ id: 'bk-held', status: 'pending', quantity: 4, total_cost: 80 }),
      booking({ id: 'bk-lapsed', status: 'cancelled', quantity: 5, total_cost: 100 }),
    ]);
    api.on(`/events/${EVENT_ID}`, () => event());
    renderWithProviders(<EventBookingsPage />, { route, path });

    expect(await screen.findByText('2 κρατήσεις · 3 θέσεις · 52.00 € σύνολο')).toBeInTheDocument();
    expect(screen.getByText('Εκκρεμεί')).toBeInTheDocument();
    expect(screen.getByText('Ακυρωμένη')).toBeInTheDocument();
  });

  it('says so when nobody has booked, and offers no notice to send', async () => {
    api.on(`/bookings/organizer/events/${EVENT_ID}`, () => []);
    api.on(`/events/${EVENT_ID}`, () => event());
    renderWithProviders(<EventBookingsPage />, { route, path });

    expect(await screen.findByText('Καμία κράτηση')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Μήνυμα στους συμμετέχοντες' })).toBeDisabled();
  });

  it('sends one notice to everyone who booked (§10)', async () => {
    api.on(`/messages/events/${EVENT_ID}/notify`, () => ({ recipients: 2 }));
    api.on(`/bookings/organizer/events/${EVENT_ID}`, () => bookings);
    api.on(`/events/${EVENT_ID}`, () => event({ status: 'cancelled' }));
    renderWithProviders(<EventBookingsPage />, { route, path });

    const open = await screen.findByRole('button', { name: 'Μήνυμα στους συμμετέχοντες' });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);

    const dialog = await screen.findByRole('dialog');
    // The subject is prefilled with the event title.
    expect(within(dialog).getByLabelText('Θέμα')).toHaveValue(
      'Σχετικά με την εκδήλωση: Συναυλία Κλασικής Μουσικής',
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή σε όλους' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Συμπληρώστε θέμα και κείμενο.',
    );

    fireEvent.change(within(dialog).getByLabelText('Μήνυμα'), {
      target: { value: 'Η εκδήλωση ακυρώθηκε, θα γίνει επιστροφή χρημάτων.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή σε όλους' }));

    await waitFor(() =>
      expect(toasts.success).toHaveBeenCalledWith('Το μήνυμα στάλθηκε σε 2 συμμετέχοντες.'),
    );
    const post = api.calls.find((c) => c.method === 'POST' && c.url.includes('/notify'));
    expect(post?.body).toEqual({
      subject: 'Σχετικά με την εκδήλωση: Συναυλία Κλασικής Μουσικής',
      body: 'Η εκδήλωση ακυρώθηκε, θα γίνει επιστροφή χρημάτων.',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the dialog open and shows why a notice failed', async () => {
    api.fail('/notify', 403, 'forbidden');
    api.on(`/bookings/organizer/events/${EVENT_ID}`, () => bookings);
    api.on(`/events/${EVENT_ID}`, () => event());
    renderWithProviders(<EventBookingsPage />, { route, path });

    const open = await screen.findByRole('button', { name: 'Μήνυμα στους συμμετέχοντες' });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Μήνυμα'), { target: { value: 'Κείμενο' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή σε όλους' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('forbidden');
    expect(toasts.success).not.toHaveBeenCalled();
  });
});
