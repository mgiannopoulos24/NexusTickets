import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import RegisterPage from '@/pages/auth/RegisterPage';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore } from '@/tests/helpers/renderWithProviders';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let api: MockFetch;
let usernameFree: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  usernameFree = true;
  api = mockFetch({
    '/auth/username-available': () => ({ available: usernameFree }),
    '/auth/register': () => null,
  });
});

const renderRegister = () =>
  renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/pending" element={<p>pending approval</p>} />
    </Routes>,
    { route: '/register' },
  );

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** Fills the required fields and waits out the debounced username check, which keeps submit disabled. */
const fillRequired = async () => {
  type('Όνομα χρήστη *', 'maria');
  expect(await screen.findByText('Διαθέσιμο όνομα χρήστη')).toBeInTheDocument();
  type('Κωδικός *', 'secret123');
  type('Επιβεβαίωση κωδικού *', 'secret123');
  type('Όνομα *', 'Μαρία');
  type('Επώνυμο *', 'Παπαδοπούλου');
  type('Email *', 'maria@example.com');
};

const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Εγγραφή' }));
  });
};

describe('RegisterPage (§2)', () => {
  it('validates every required field before calling the server', async () => {
    renderRegister();
    await submit();

    expect(
      await screen.findByText('Το όνομα χρήστη πρέπει να έχει τουλάχιστον 3 χαρακτήρες'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες'),
    ).toBeInTheDocument();
    expect(screen.getByText('Εισάγετε όνομα')).toBeInTheDocument();
    expect(screen.getByText('Εισάγετε επώνυμο')).toBeInTheDocument();
    expect(screen.getByText('Εισάγετε έγκυρο email')).toBeInTheDocument();
    expect(api.matching('/auth/register')).toHaveLength(0);
  });

  it('requires the password confirmation to match', async () => {
    renderRegister();
    await fillRequired();
    type('Επιβεβαίωση κωδικού *', 'secret124');
    await submit();

    expect(await screen.findByText('Οι κωδικοί δεν ταιριάζουν')).toBeInTheDocument();
    expect(api.matching('/auth/register')).toHaveLength(0);
  });

  it('requires a password with both letters and digits', async () => {
    renderRegister();
    await fillRequired();
    type('Κωδικός *', 'onlyletters');
    type('Επιβεβαίωση κωδικού *', 'onlyletters');
    await submit();

    expect(
      await screen.findByText(
        'Ο κωδικός πρέπει να περιέχει τουλάχιστον ένα γράμμα και έναν αριθμό',
      ),
    ).toBeInTheDocument();
  });

  it('accepts only a nine-digit VAT number', async () => {
    renderRegister();
    await fillRequired();
    type('ΑΦΜ', '12345');
    await submit();

    expect(await screen.findByText('Το ΑΦΜ πρέπει να αποτελείται από 9 ψηφία')).toBeInTheDocument();
    expect(api.matching('/auth/register')).toHaveLength(0);
  });

  it('rejects a malformed phone number', async () => {
    renderRegister();
    await fillRequired();
    type('Τηλέφωνο', '12-34');
    await submit();

    expect(await screen.findByText('Εισάγετε έγκυρο τηλέφωνο (8–15 ψηφία)')).toBeInTheDocument();
    expect(api.matching('/auth/register')).toHaveLength(0);
  });

  it('warns while typing when the username is already taken', async () => {
    usernameFree = false;
    renderRegister();
    type('Όνομα χρήστη *', 'admin');

    expect(await screen.findByText('Το όνομα χρήστη χρησιμοποιείται ήδη')).toBeInTheDocument();
    expect(api.matching('username=admin')).not.toHaveLength(0);
  });

  it('submits the registration with the chosen role and waits for approval (§2, §4)', async () => {
    renderRegister();
    fireEvent.click(screen.getByRole('radio', { name: /Διοργανωτής/ }));
    await fillRequired();
    type('Τηλέφωνο', '210 1234567');
    type('ΑΦΜ', '123456789');
    type('Γεωγρ. πλάτος', '37,9838');
    type('Γεωγρ. μήκος', '23.7275');
    await submit();

    expect(await screen.findByText('pending approval')).toBeInTheDocument();
    expect(api.matching('/auth/register')[0].body).toEqual({
      username: 'maria',
      password: 'secret123',
      confirm_password: 'secret123',
      first_name: 'Μαρία',
      last_name: 'Παπαδοπούλου',
      email: 'maria@example.com',
      phone: '210 1234567',
      address: null,
      city: null,
      country: null,
      latitude: 37.9838,
      longitude: 23.7275,
      vat_number: '123456789',
      role: 'organizer',
    });
  });

  it('re-checks the username on submit and stops if it was taken meanwhile', async () => {
    renderRegister();
    await fillRequired();
    usernameFree = false;
    await submit();

    expect(await screen.findByText('Το όνομα χρήστη χρησιμοποιείται ήδη')).toBeInTheDocument();
    expect(api.matching('/auth/register')).toHaveLength(0);
  });

  it('explains a registration the server refuses', async () => {
    api.fail('/auth/register', 409, 'email already taken');
    renderRegister();
    await fillRequired();
    await submit();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Το email χρησιμοποιείται ήδη.'),
    );
    expect(screen.queryByText('pending approval')).not.toBeInTheDocument();
  });
});
