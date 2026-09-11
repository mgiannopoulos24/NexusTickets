import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import SupportPage from '@/pages/support/SupportPage';
import AdminSupportPage from '@/pages/admin/AdminSupportPage';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';
import type { SupportThread, SupportTicket } from '@/types/support';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

const ME = 'u-1';

function ticket(over: Partial<SupportTicket> = {}): SupportTicket {
  return {
    id: 't-1',
    user_id: ME,
    subject: 'Δεν μπορώ να συνδεθώ',
    status: 'open',
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    user: { id: ME, username: 'tester', full_name: 'Test User', role: 'attendee' },
    ...over,
  };
}

function thread(over: Partial<SupportTicket> = {}): SupportThread {
  return {
    ticket: ticket(over),
    messages: [
      {
        id: 'm-1',
        ticket_id: 't-1',
        author_id: ME,
        body: 'Ο κωδικός μου δεν γίνεται δεκτός.',
        created_at: '2026-03-01T10:00:00Z',
        from_admin: false,
        author: { id: ME, username: 'tester', full_name: 'Test User', role: 'attendee' },
      },
      {
        id: 'm-2',
        ticket_id: 't-1',
        author_id: 'a-1',
        body: 'Δοκιμάστε επαναφορά.',
        created_at: '2026-03-01T11:00:00Z',
        from_admin: true,
        author: { id: 'a-1', username: 'admin', full_name: 'Admin User', role: 'admin' },
      },
    ],
  };
}

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  api = mockFetch();
});

describe('SupportPage — user', () => {
  beforeEach(() => signIn({ id: ME, role: 'attendee' }));

  it('lists my tickets with their status', async () => {
    api.on('/support/tickets/me', () => ({
      data: [ticket(), ticket({ id: 't-2', subject: 'Απόδειξη', status: 'answered' })],
      meta: { total: 2, limit: 20, offset: 0 },
    }));
    renderWithProviders(<SupportPage />, { route: '/support' });

    expect(await screen.findByRole('link', { name: 'Δεν μπορώ να συνδεθώ' })).toBeInTheDocument();
    expect(screen.getByText('Ανοιχτό')).toBeInTheDocument();
    expect(screen.getByText('Απαντήθηκε')).toBeInTheDocument();
    expect(screen.getByText('1–2 από 2')).toBeInTheDocument();
  });

  it('opens a new ticket from the footer link and lands on its thread', async () => {
    // Fragments match in registration order, so the more specific paths go first.
    api.on('/support/tickets/me', () => ({ data: [], meta: { total: 0, limit: 20, offset: 0 } }));
    api.on('/support/tickets/t-9', () => thread({ id: 't-9', subject: 'Νέο θέμα' }));
    api.on('/support/tickets', () => ticket({ id: 't-9', subject: 'Νέο θέμα' }));
    renderWithProviders(<SupportPage />, { route: '/support?new=1' });

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Συμπληρώστε');

    fireEvent.change(within(dialog).getByLabelText('Θέμα'), { target: { value: 'Νέο θέμα' } });
    fireEvent.change(within(dialog).getByLabelText('Περιγραφή'), {
      target: { value: 'Περιγραφή προβλήματος' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή' }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Το αίτημα καταχωρήθηκε.'));
    const post = api.calls.find((c) => c.method === 'POST' && c.url.endsWith('/support/tickets'));
    expect(post?.body).toEqual({ subject: 'Νέο θέμα', body: 'Περιγραφή προβλήματος' });
    expect(await screen.findByRole('heading', { name: 'Νέο θέμα' })).toBeInTheDocument();
  });

  it('shows the thread, marks admin replies, and lets me reply', async () => {
    api.on('/support/tickets/t-1', () => thread({ status: 'answered' }));
    renderWithProviders(<SupportPage />, { route: '/support?id=t-1' });

    const messages = await screen.findAllByTestId('ticket-message');
    expect(messages).toHaveLength(2);
    expect(within(messages[1]).getByText(/Υποστήριξη/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Απάντηση'), { target: { value: 'Ευχαριστώ!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Αποστολή' }));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Η απάντηση στάλθηκε.'));
    const post = api.calls.find((c) => c.method === 'POST' && c.url.includes('/t-1/messages'));
    expect(post?.body).toEqual({ body: 'Ευχαριστώ!' });
  });

  it('offers no reply box on a closed ticket', async () => {
    api.on('/support/tickets/t-1', () => thread({ status: 'closed' }));
    renderWithProviders(<SupportPage />, { route: '/support?id=t-1' });
    await screen.findByRole('heading', { name: 'Δεν μπορώ να συνδεθώ' });
    expect(screen.queryByLabelText('Απάντηση')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Κλείσιμο/ })).not.toBeInTheDocument();
  });
});

describe('AdminSupportPage', () => {
  beforeEach(() => signIn({ id: 'a-1', role: 'admin' }));

  it('defaults to open tickets and shows who opened each', async () => {
    api.on('/support/admin/counts', () => ({ open: 1, answered: 2, closed: 3 }));
    api.on('/support/admin/tickets', (url) => {
      expect(url).toContain('status=open');
      return { data: [ticket()], meta: { total: 1, limit: 20, offset: 0 } };
    });
    renderWithProviders(<AdminSupportPage />, { route: '/admin/support' });

    const row = await screen.findByTestId('ticket-row');
    expect(within(row).getByText('Test User')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ανοιχτό (1)' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('1 ανοιχτά · 2 απαντημένα · 3 κλειστά')).toBeInTheDocument();
  });

  it('closes a ticket from the thread', async () => {
    api.on('/support/tickets/t-1/close', () => thread({ status: 'closed' }));
    api.on('/support/tickets/t-1', () => thread());
    renderWithProviders(<AdminSupportPage />, { route: '/admin/support?id=t-1' });

    fireEvent.click(await screen.findByRole('button', { name: /Κλείσιμο/ }));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Το αίτημα έκλεισε.'));
    expect(api.calls.some((c) => c.method === 'PATCH' && c.url.includes('/t-1/close'))).toBe(true);
  });
});
