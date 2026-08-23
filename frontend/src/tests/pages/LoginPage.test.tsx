import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import LoginPage from '@/pages/auth/LoginPage';
import { store } from '@/app/store';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore } from '@/tests/helpers/renderWithProviders';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  localStorage.clear();
  api = mockFetch({
    '/auth/login': () => ({ access_token: 'access-1', refresh_token: 'refresh-1' }),
    '/users/me': () => ({
      id: 'u-1',
      username: 'attendee',
      first_name: 'Demo',
      last_name: 'Attendee',
      email: 'attendee@example.com',
      role: 'attendee',
      account_status: 'approved',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }),
  });
});

const fillAndSubmit = async (username: string, password: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Όνομα χρήστη'), { target: { value: username } });
    fireEvent.change(screen.getByLabelText('Κωδικός'), { target: { value: password } });
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Σύνδεση' }));
  });
};

describe('LoginPage (§3)', () => {
  it('requires both fields', async () => {
    renderWithProviders(<LoginPage />, { route: '/login', browserRouter: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Σύνδεση' }));
    });
    expect(await screen.findByText('Εισάγετε όνομα χρήστη')).toBeInTheDocument();
    expect(screen.getByText('Εισάγετε κωδικό')).toBeInTheDocument();
    expect(api.matching('/auth/login')).toHaveLength(0);
  });

  it('signs in, stores the tokens and loads the profile', async () => {
    renderWithProviders(<LoginPage />, { route: '/login', browserRouter: true });
    await fillAndSubmit('attendee', 'ChangeMe123!');

    await waitFor(() => expect(api.matching('/auth/login')).toHaveLength(1));
    expect(api.matching('/auth/login')[0].body).toEqual({
      username: 'attendee',
      password: 'ChangeMe123!',
    });
    await waitFor(() => expect(localStorage.getItem('access_token')).toBe('access-1'));
    await waitFor(() => expect(store.getState().auth.user?.username).toBe('attendee'));
  });

  it('trims a padded username before sending it', async () => {
    renderWithProviders(<LoginPage />, { route: '/login', browserRouter: true });
    await fillAndSubmit('  attendee  ', 'ChangeMe123!');
    await waitFor(() =>
      expect(api.matching('/auth/login')[0].body).toMatchObject({ username: 'attendee' }),
    );
  });

  it('reports bad credentials without signing in', async () => {
    api.fail('/auth/login', 401, 'invalid credentials');
    renderWithProviders(<LoginPage />, { route: '/login', browserRouter: true });
    await fillAndSubmit('attendee', 'wrong');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(store.getState().auth.user).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
