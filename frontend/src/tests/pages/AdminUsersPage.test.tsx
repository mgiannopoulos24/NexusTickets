import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';

import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';
import type { User } from '@/types/models';

function user(over: Partial<User>): User {
  return {
    id: 'u-x',
    username: 'someone',
    first_name: 'Some',
    last_name: 'One',
    email: 'some@example.com',
    role: 'attendee',
    account_status: 'approved',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const people = [
  user({ id: 'u-1', username: 'pending1', first_name: 'Νέος', account_status: 'pending' }),
  user({ id: 'u-2', username: 'approved1', first_name: 'Παλιός', account_status: 'approved' }),
  user({
    id: 'u-3',
    username: 'organizer1',
    first_name: 'Διοργανωτής',
    role: 'organizer',
    account_status: 'rejected',
  }),
];

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  signIn({ role: 'admin' });
  api = mockFetch({ '/users/admin': () => people });
});

async function renderUsers() {
  renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });
  await screen.findByText('@pending1');
}

describe('AdminUsersPage (§4)', () => {
  it('lists every user with role and status', async () => {
    await renderUsers();
    expect(screen.getByText('@approved1')).toBeInTheDocument();
    expect(screen.getByText('@organizer1')).toBeInTheDocument();
    expect(screen.getByText('Διοργανωτής', { selector: 'div' })).toBeInTheDocument();
  });

  it('counts the accounts waiting for approval', async () => {
    await renderUsers();
    expect(screen.getByText('1 εκκρεμεί')).toBeInTheDocument();
  });

  it('filters by account status', async () => {
    await renderUsers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Εκκρεμείς' }));
    });
    expect(screen.getByText('@pending1')).toBeInTheDocument();
    expect(screen.queryByText('@approved1')).not.toBeInTheDocument();
  });

  it('searches by name, username or email', async () => {
    await renderUsers();
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Αναζήτηση ονόματος/), {
        target: { value: 'organizer1' },
      });
    });
    expect(screen.getByText('@organizer1')).toBeInTheDocument();
    expect(screen.queryByText('@pending1')).not.toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    await renderUsers();
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Αναζήτηση ονόματος/), {
        target: { value: 'δεν υπάρχει' },
      });
    });
    expect(screen.getByText('Δεν βρέθηκαν χρήστες.')).toBeInTheDocument();
  });

  it('links each row to that user for approval or rejection', async () => {
    await renderUsers();
    const row = screen.getByText('@pending1').closest('a');
    expect(row).toHaveAttribute('href', '/admin/users/u-1');
  });

  it('reports a failed load', async () => {
    api.fail('/users/admin', 500, 'boom');
    renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });
    expect(await screen.findByText(/Σφάλμα φόρτωσης χρηστών|boom/)).toBeInTheDocument();
  });
});
