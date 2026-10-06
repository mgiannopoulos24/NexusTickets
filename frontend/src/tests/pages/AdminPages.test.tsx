import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminEventEditPage from '@/pages/admin/AdminEventEditPage';
import AdminEventsPage from '@/pages/admin/AdminEventsPage';
import AdminUserDetailPage from '@/pages/admin/AdminUserDetailPage';
import { category, event, EVENT_ID } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';
import type { User } from '@/types/models';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

function user(over: Partial<User> = {}): User {
  return {
    id: 'u-9',
    username: 'maria',
    email: 'maria@example.com',
    first_name: 'Μαρία',
    last_name: 'Παπαδοπούλου',
    phone: '2101234567',
    vat_number: '123456789',
    address: 'Πανεπιστημίου 30',
    city: 'Αθήνα',
    country: 'Ελλάδα',
    latitude: null,
    longitude: null,
    role: 'attendee',
    account_status: 'pending',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as User;
}

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  api = mockFetch();
  signIn({ id: 'a-1', role: 'admin' });
});

describe('AdminUserDetailPage (§4)', () => {
  const route = '/admin/users/u-9';
  const path = '/admin/users/:id';

  /** Serves the user and lets the approve/reject/role calls change it. */
  const serveUser = (initial: User) => {
    let current = initial;
    api.on(
      '/users/admin/u-9/approve',
      () => (current = { ...current, account_status: 'approved' }),
    );
    api.on('/users/admin/u-9/reject', () => (current = { ...current, account_status: 'rejected' }));
    api.on('/users/admin/u-9/role', () => (current = { ...current, role: 'organizer' }));
    api.on('/users/admin/u-9', () => current);
  };

  it('shows the applicant’s registration details', async () => {
    serveUser(user());
    renderWithProviders(<AdminUserDetailPage />, { route, path });

    expect(await screen.findByRole('heading', { name: 'Μαρία Παπαδοπούλου' })).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
    expect(screen.getByText('123456789')).toBeInTheDocument();
    expect(screen.getByText('Πανεπιστημίου 30')).toBeInTheDocument();
    expect(screen.getByText('Η αίτηση εγγραφής εκκρεμεί έγκριση.')).toBeInTheDocument();
  });

  it('approves a pending registration', async () => {
    serveUser(user());
    renderWithProviders(<AdminUserDetailPage />, { route, path });

    fireEvent.click(await screen.findByRole('button', { name: 'Έγκριση' }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Ο χρήστης @maria εγκρίθηκε'));
    expect(api.calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/u-9/approve'))).toBe(
      true,
    );
    expect(await screen.findByText('Ο λογαριασμός είναι ενεργός.')).toBeInTheDocument();
  });

  it('rejects a pending registration', async () => {
    serveUser(user());
    renderWithProviders(<AdminUserDetailPage />, { route, path });

    fireEvent.click(await screen.findByRole('button', { name: 'Απόρριψη' }));

    await waitFor(() =>
      expect(toasts.success).toHaveBeenCalledWith('Η αίτηση του @maria απορρίφθηκε'),
    );
    expect(api.calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/u-9/reject'))).toBe(true);
    expect(await screen.findByText('Η αίτηση έχει απορριφθεί.')).toBeInTheDocument();
  });

  it('can revoke an approved account and re-approve a rejected one', async () => {
    serveUser(user({ account_status: 'approved' }));
    renderWithProviders(<AdminUserDetailPage />, { route, path });

    fireEvent.click(await screen.findByRole('button', { name: 'Απόρριψη πρόσβασης' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Έγκριση τώρα' }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Ο χρήστης @maria εγκρίθηκε'));
    const patches = api.calls.filter((c) => c.method === 'PATCH').map((c) => c.url);
    expect(patches[0]).toMatch(/\/reject$/);
    expect(patches[1]).toMatch(/\/approve$/);
  });

  it('switches a user between attendee and organizer', async () => {
    serveUser(user({ account_status: 'approved' }));
    renderWithProviders(<AdminUserDetailPage />, { route, path });

    const select = await screen.findByLabelText('Ρόλος');
    fireEvent.change(select, { target: { value: 'organizer' } });

    await waitFor(() => expect(toasts.success).toHaveBeenCalled());
    const patch = api.calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/u-9/role'));
    expect(patch?.body).toEqual({ role: 'organizer' });
  });

  it('does not offer a role switch for an administrator', async () => {
    serveUser(user({ role: 'admin', account_status: 'approved' }));
    renderWithProviders(<AdminUserDetailPage />, { route, path });

    await screen.findByRole('heading', { name: 'Μαρία Παπαδοπούλου' });
    expect(screen.queryByLabelText('Ρόλος')).not.toBeInTheDocument();
  });

  it('shows the server’s reason when an approval fails', async () => {
    api.fail('/u-9/approve', 500, 'database unavailable');
    serveUser(user());
    renderWithProviders(<AdminUserDetailPage />, { route, path });

    fireEvent.click(await screen.findByRole('button', { name: 'Έγκριση' }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(screen.getByText('Η αίτηση εγγραφής εκκρεμεί έγκριση.')).toBeInTheDocument();
  });
});

describe('AdminDashboard', () => {
  it('counts users and the registrations waiting for approval', async () => {
    api.on('/users/admin', () => [
      user({ id: 'u-1' }),
      user({ id: 'u-2' }),
      user({ id: 'u-3', account_status: 'approved' }),
    ]);
    renderWithProviders(<AdminDashboard />, { route: '/admin' });

    expect(await screen.findByText('2 εκκρεμούν')).toBeInTheDocument();
    expect(screen.getByText('3 συνολικά · έγκριση/απόρριψη αιτήσεων')).toBeInTheDocument();
    const usersCard = screen.getByRole('heading', { name: 'Χρήστες' }).closest('a');
    expect(usersCard).toHaveAttribute('href', '/admin/users');
    const exportsCard = screen.getByRole('heading', { name: 'Εξαγωγές' }).closest('a');
    expect(exportsCard).toHaveAttribute('href', '/admin/events');
  });
});

describe('AdminEventsPage (§12)', () => {
  const page = (events = [event()], total = events.length) => ({
    data: events,
    meta: { total, limit: 20, offset: 0 },
  });

  let clicked: HTMLAnchorElement[];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    clicked = [];
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    // Record the download instead of letting the test DOM navigate.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it('lists every event with its status, linked to the admin editor', async () => {
    api.on('/events/admin', () =>
      page([event(), event({ id: 'ev-2', title: 'Θεατρική παράσταση', status: 'cancelled' })]),
    );
    renderWithProviders(<AdminEventsPage />, { route: '/admin/events' });

    const link = await screen.findByRole('link', { name: /Συναυλία Κλασικής Μουσικής/ });
    expect(link).toHaveAttribute('href', `/admin/events/${EVENT_ID}/edit`);
    expect(within(link).getByText('Δημοσιευμένο')).toBeInTheDocument();
    const cancelled = screen.getByRole('link', { name: /Θεατρική παράσταση/ });
    expect(within(cancelled).getByText('Ακυρωμένο')).toBeInTheDocument();
    expect(screen.getByText('2 εκδηλώσεις')).toBeInTheDocument();
  });

  it('searches and filters by status', async () => {
    api.on('/events/admin', () => page());
    renderWithProviders(<AdminEventsPage />, { route: '/admin/events' });
    await screen.findByText('Συναυλία Κλασικής Μουσικής');

    fireEvent.change(screen.getByLabelText('Κατάσταση'), { target: { value: 'draft' } });
    await waitFor(() => expect(api.calls.at(-1)?.url).toContain('status=draft'));

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Αθήνα' } });
    fireEvent.click(screen.getByRole('button', { name: 'Αναζήτηση' }));
    await waitFor(() => {
      const url = decodeURIComponent(api.calls.at(-1)!.url);
      expect(url).toContain('q=Αθήνα');
      expect(url).toContain('status=draft');
    });
  });

  it('explains an empty filtered result', async () => {
    api.on('/events/admin', () => page([]));
    renderWithProviders(<AdminEventsPage />, { route: '/admin/events?status=completed' });
    expect(
      await screen.findByText('Δεν βρέθηκαν εκδηλώσεις για αυτά τα κριτήρια.'),
    ).toBeInTheDocument();
  });

  it('downloads the XML and JSON catalogues', async () => {
    api.on('/events/admin', () => page());
    renderWithProviders(<AdminEventsPage />, { route: '/admin/events' });

    fireEvent.click(await screen.findByRole('button', { name: 'Εξαγωγή XML' }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Εξαγωγή JSON' }));
    await waitFor(() => expect(clicked).toHaveLength(2));

    expect(clicked.map((a) => a.download)).toEqual(['events.xml', 'events.json']);
    expect(api.matching('/admin/events/export/xml')).toHaveLength(1);
    expect(api.matching('/admin/events/export/json')).toHaveLength(1);
  });

  it('reports a failed export', async () => {
    api.fail('/export/xml', 500);
    api.on('/events/admin', () => page());
    renderWithProviders(<AdminEventsPage />, { route: '/admin/events' });

    fireEvent.click(await screen.findByRole('button', { name: 'Εξαγωγή XML' }));
    expect(await screen.findByText('Η εξαγωγή απέτυχε (500)')).toBeInTheDocument();
    expect(clicked).toHaveLength(0);
  });
});

describe('AdminEventEditPage', () => {
  const route = `/admin/events/${EVENT_ID}/edit`;
  const path = '/admin/events/:id/edit';

  it('saves any organizer’s event, including its status', async () => {
    api.on('/categories', () => [category()]);
    // An administrator edits events that belong to other organizers.
    api.on(`/events/admin/${EVENT_ID}`, () => event({ organizer_id: 'someone-else' }));
    renderWithProviders(<AdminEventEditPage />, { route, path });

    await screen.findByRole('heading', { name: 'Συναυλία Κλασικής Μουσικής' });
    const status = screen.getByDisplayValue('Δημοσιευμένο');
    fireEvent.change(status, { target: { value: 'cancelled' } });
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    expect(await screen.findByText('Αποθηκεύτηκε')).toBeInTheDocument();
    const patch = api.calls.find((c) => c.method === 'PATCH');
    expect(patch?.url).toContain(`/events/admin/${EVENT_ID}`);
    expect(patch?.body).toMatchObject({ status: 'cancelled', title: 'Συναυλία Κλασικής Μουσικής' });
  });

  it('shows the server’s reason when saving fails', async () => {
    api.on('/categories', () => [category()]);
    api.on(`/events/admin/${EVENT_ID}`, () => event());
    renderWithProviders(<AdminEventEditPage />, { route, path });
    await screen.findByRole('heading', { name: 'Συναυλία Κλασικής Μουσικής' });

    api.fail(`/events/admin/${EVENT_ID}`, 400, 'end must be after start');
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }));
    expect(await screen.findByText('end must be after start')).toBeInTheDocument();
  });
});
