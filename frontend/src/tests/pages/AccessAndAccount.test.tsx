import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AccountPage from '@/pages/auth/AccountPage';
import SettingsPage from '@/pages/auth/SettingsPage';
import routes from '@/routes/routes';
import { store } from '@/app/store';
import { setTokens } from '@/utils/api';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';
import type { UserRole } from '@/types/enums';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  api = mockFetch();
});

/**
 * Who may open each protected screen. Written out by hand rather than read
 * from routes.tsx, so a change to the route table has to be made here too.
 */
const ACCESS: Record<string, UserRole[]> = {
  '/admin': ['admin'],
  '/admin/users': ['admin'],
  '/admin/users/:id': ['admin'],
  '/admin/events': ['admin'],
  '/admin/events/:id/edit': ['admin'],
  '/admin/support': ['admin'],
  '/organizer': ['organizer', 'admin'],
  '/organizer/events': ['organizer', 'admin'],
  '/organizer/events/new': ['organizer', 'admin'],
  '/organizer/events/:id/edit': ['organizer', 'admin'],
  '/organizer/events/:id/bookings': ['organizer', 'admin'],
  '/bookings/me': ['attendee', 'organizer', 'admin'],
  '/messages': ['attendee', 'organizer', 'admin'],
  '/support': ['attendee', 'organizer', 'admin'],
  '/account': ['attendee', 'organizer', 'admin'],
  '/settings': ['attendee', 'organizer', 'admin'],
};

const SIGNED_IN: UserRole[] = ['attendee', 'organizer', 'admin'];

/** Fills route params so a pattern can be visited. */
const visit = (path: string) => path.replace(':id', '00000000-0000-0000-0000-000000000001');

/** Mounts every protected route behind the real guard, with a stub page. */
function renderGuarded(url: string) {
  const guarded = routes.filter((r) => r.protected);
  return renderWithProviders(
    <Routes>
      {guarded.map((r) => (
        <Route
          key={r.path}
          path={r.path}
          element={
            <ProtectedRoute allowedRoles={r.roles!}>
              <p>page {r.path}</p>
            </ProtectedRoute>
          }
        />
      ))}
      <Route path="/login" element={<p>login page</p>} />
      <Route path="/unauthorized" element={<p>unauthorized page</p>} />
    </Routes>,
    { route: url },
  );
}

describe('Role-based access to screens', () => {
  it('guards exactly the screens listed here', () => {
    const guarded = routes.filter((r) => r.protected).map((r) => r.path);
    expect(guarded.sort()).toEqual(Object.keys(ACCESS).sort());
  });

  it.each(Object.keys(ACCESS))('sends a guest from %s to the login page', (path) => {
    renderGuarded(visit(path));
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  const cases = Object.entries(ACCESS).flatMap(([path, allowed]) =>
    SIGNED_IN.map((role) => [path, role, allowed.includes(role)] as const),
  );

  it.each(cases)('%s as %s → allowed: %s', (path, role, allowed) => {
    signIn({ role });
    renderGuarded(visit(path));
    if (allowed) {
      expect(screen.getByText(`page ${path}`)).toBeInTheDocument();
    } else {
      expect(screen.getByText('unauthorized page')).toBeInTheDocument();
    }
  });

  it('leaves the public screens open to guests (§11)', () => {
    const open = routes.filter((r) => !r.protected).map((r) => r.path);
    expect(open).toEqual(
      expect.arrayContaining(['/', '/events', '/events/:id', '/login', '/register']),
    );
  });
});

describe('AccountPage', () => {
  const me = {
    id: 'u-1',
    username: 'maria',
    email: 'maria@example.com',
    first_name: 'Μαρία',
    last_name: 'Παπά',
    phone: null,
    address: null,
    city: 'Αθήνα',
    country: null,
    latitude: null,
    longitude: null,
    vat_number: null,
    role: 'attendee',
    account_status: 'approved',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => signIn({ id: 'u-1', role: 'attendee' }));

  it('loads the profile and saves the edited fields', async () => {
    api.on('/users/me', () => me);
    renderWithProviders(<AccountPage />, { route: '/account' });

    const lastName = await screen.findByLabelText('Επώνυμο');
    await waitFor(() => expect(lastName).toHaveValue('Παπά'));
    // From here on the server answers with the saved profile.
    api.on('/users/me', () => ({ ...me, last_name: 'Νέο', phone: '2101234567' }));
    fireEvent.change(lastName, { target: { value: 'Νέο' } });
    fireEvent.change(screen.getByLabelText('Τηλέφωνο'), { target: { value: '2101234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση αλλαγών' }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Τα στοιχεία ενημερώθηκαν'));
    const patch = api.calls.find((c) => c.method === 'PATCH' && c.url.includes('/users/me'));
    expect(patch?.body).toMatchObject({
      first_name: 'Μαρία',
      last_name: 'Νέο',
      phone: '2101234567',
      city: 'Αθήνα',
      address: null,
    });
    expect(store.getState().auth.user?.last_name).toBe('Νέο');
  });

  it('shows the server’s reason when saving fails', async () => {
    api.on('/users/me', () => me);
    renderWithProviders(<AccountPage />, { route: '/account' });
    await waitFor(() => expect(screen.getByLabelText('Επώνυμο')).toHaveValue('Παπά'));

    api.fail('/users/me', 409, 'email already taken');
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση αλλαγών' }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('email already taken'));
  });
});

describe('SettingsPage', () => {
  beforeEach(() => signIn({ role: 'attendee' }));

  it('signs the user out and revokes the refresh token', async () => {
    setTokens('test-token', 'refresh-1');
    renderWithProviders(<SettingsPage />, { route: '/settings' });
    fireEvent.click(screen.getByRole('button', { name: 'Αποσύνδεση' }));

    await waitFor(() => expect(api.matching('/auth/logout')).toHaveLength(1));
    expect(api.matching('/auth/logout')[0].body).toEqual({ refresh_token: 'refresh-1' });
    // The app shell drops the Redux session on the cleared-tokens event; here
    // it is enough that the stored tokens are gone.
    await waitFor(() => expect(localStorage.getItem('refresh_token')).toBeNull());
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('says account deletion is not available, after asking first', () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    renderWithProviders(<SettingsPage />, { route: '/settings' });

    fireEvent.click(screen.getByRole('button', { name: 'Διαγραφή λογαριασμού' }));
    expect(confirm).toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(
      'Η διαγραφή λογαριασμού δεν είναι διαθέσιμη αυτή τη στιγμή',
    );
  });
});
