import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import OrganizerEventNewPage from '@/pages/organizer/OrganizerEventNewPage';
import OrganizerEventEditPage from '@/pages/organizer/OrganizerEventEditPage';
import { category, event, EVENT_ID } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';
import type { Event } from '@/types/models';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

const ORGANIZER = 'org-1';

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  api = mockFetch({ '/categories': () => [category(), category({ id: 'cat-2', name: 'Θέατρο' })] });
  signIn({ id: ORGANIZER, role: 'organizer' });
});

/**
 * The event forms label their fields with a sibling <label> rather than
 * htmlFor, so find the label and take the control next to it.
 */
function field(label: RegExp): HTMLInputElement | HTMLTextAreaElement {
  const el = screen.getAllByText(label, { selector: 'label' })[0];
  const control = el.parentElement!.querySelector('input, textarea');
  if (!control) throw new Error(`no control next to ${label}`);
  return control as HTMLInputElement | HTMLTextAreaElement;
}

const type = (label: RegExp, value: string) =>
  fireEvent.change(field(label), { target: { value } });

describe('OrganizerEventNewPage (§7α)', () => {
  const renderNew = () =>
    renderWithProviders(
      <Routes>
        <Route path="/organizer/events/new" element={<OrganizerEventNewPage />} />
        <Route path="/organizer/events/:id/edit" element={<p>edit screen</p>} />
      </Routes>,
      { route: '/organizer/events/new' },
    );

  const fillRequired = async () => {
    await screen.findByRole('checkbox', { name: 'Μουσική' });
    type(/^Τίτλος/, 'Νέα συναυλία');
    type(/^Περιγραφή/, 'Μια νέα βραδιά.');
    type(/^Χώρος/, 'Ηρώδειο');
    type(/^Πόλη/, 'Αθήνα');
  };

  it('creates the event with its ticket types and opens it for editing', async () => {
    api.on('/events/organizer', () => event({ id: 'new-id', status: 'draft' }));
    renderNew();
    await fillRequired();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Μουσική' }));
    fireEvent.change(screen.getByPlaceholderText('Τιμή'), { target: { value: '15,5' } });
    fireEvent.change(screen.getByPlaceholderText('Θέσεις'), { target: { value: '80' } });

    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία' }));

    expect(await screen.findByText('edit screen')).toBeInTheDocument();
    const post = api.calls.find((c) => c.method === 'POST' && c.url.endsWith('/events/organizer'));
    expect(post?.body).toMatchObject({
      title: 'Νέα συναυλία',
      description: 'Μια νέα βραδιά.',
      venue: 'Ηρώδειο',
      city: 'Αθήνα',
      capacity: 100,
      categories: ['Μουσική'],
      ticket_types: [{ name: 'Γενική είσοδος', price: 15.5, quantity: 80 }],
    });
  });

  it('requires at least one category', async () => {
    renderNew();
    await fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία' }));

    expect(await screen.findByText('Επιλέξτε τουλάχιστον μία κατηγορία.')).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('refuses ticket types that add up to more than the capacity (§7α)', async () => {
    renderNew();
    await fillRequired();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Μουσική' }));
    fireEvent.change(screen.getByLabelText(/Χωρητικότητα/), { target: { value: '50' } });
    // The error repeats the rule the ticket section states as a hint, so the
    // text appears a second time once the error shows.
    const rule =
      'Το άθροισμα των θέσεων ανά τύπο δεν μπορεί να υπερβαίνει τη συνολική χωρητικότητα.';
    expect(screen.getAllByText(rule)).toHaveLength(1);
    // The default row asks for 100 seats.
    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία' }));

    await waitFor(() => expect(screen.getAllByText(rule)).toHaveLength(2));
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('adds and removes ticket type rows, keeping at least one', async () => {
    renderNew();
    await screen.findByRole('checkbox', { name: 'Μουσική' });
    const remove = () => screen.getAllByRole('button', { name: 'Αφαίρεση τύπου' });

    expect(remove()).toHaveLength(1);
    expect(remove()[0]).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Προσθήκη τύπου' }));
    expect(remove()).toHaveLength(2);
    fireEvent.click(remove()[1]);
    expect(remove()).toHaveLength(1);
  });

  it('shows the server’s reason when creation fails', async () => {
    api.fail(/\/events\/organizer$/, 400, 'title is required');
    renderNew();
    await fillRequired();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Μουσική' }));
    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία' }));

    expect(await screen.findByText('title is required')).toBeInTheDocument();
    expect(screen.queryByText('edit screen')).not.toBeInTheDocument();
  });
});

describe('OrganizerEventEditPage (§7γ)', () => {
  const route = `/organizer/events/${EVENT_ID}/edit`;
  const path = '/organizer/events/:id/edit';

  const serve = (ev: Event) => api.on(`/events/${EVENT_ID}`, () => ev);

  const renderEdit = async () => {
    renderWithProviders(<OrganizerEventEditPage />, { route, path });
    return screen.findByRole('heading', { name: 'Συναυλία Κλασικής Μουσικής' });
  };

  it('saves the edited fields', async () => {
    api.on(`/events/organizer/${EVENT_ID}`, () => event({ title: 'Νέος τίτλος' }));
    serve(event());
    await renderEdit();

    type(/^Τίτλος/, 'Νέος τίτλος');
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    expect(await screen.findByText('Αποθηκεύτηκε')).toBeInTheDocument();
    const patch = api.calls.find((c) => c.method === 'PATCH');
    expect(patch?.url).toContain(`/events/organizer/${EVENT_ID}`);
    expect(patch?.body).toMatchObject({
      title: 'Νέος τίτλος',
      capacity: 300,
      categories: ['Μουσική'],
    });
  });

  it('publishes a draft (§7α)', async () => {
    api.on(`/events/organizer/${EVENT_ID}/publish`, () => event({ status: 'published' }));
    serve(event({ status: 'draft' }));
    await renderEdit();

    expect(screen.getByText('Πρόχειρο')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ακύρωση εκδήλωσης' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Δημοσίευση' }));

    expect(await screen.findByText('Δημοσιεύτηκε')).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/publish'))).toBe(true);
    expect(screen.getByText('Δημοσιευμένο')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ακύρωση εκδήλωσης' })).toBeInTheDocument();
  });

  it('cancels a published event after confirmation and locks the form', async () => {
    api.on(`/events/organizer/${EVENT_ID}/cancel`, () => event({ status: 'cancelled' }));
    serve(event({ status: 'published' }));
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    await renderEdit();

    fireEvent.click(screen.getByRole('button', { name: 'Ακύρωση εκδήλωσης' }));

    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByText('Η εκδήλωση ακυρώθηκε')).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/cancel'))).toBe(true);
    expect(
      screen.getByText('Η εκδήλωση έχει ακυρωθεί και δεν μπορεί να τροποποιηθεί.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Αποθήκευση' })).toBeDisabled();
  });

  it('leaves the event alone when the cancellation is not confirmed', async () => {
    serve(event({ status: 'published' }));
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    await renderEdit();

    fireEvent.click(screen.getByRole('button', { name: 'Ακύρωση εκδήλωσης' }));
    expect(api.calls.some((c) => c.url.endsWith('/cancel'))).toBe(false);
  });

  it('shows a completed event read-only', async () => {
    serve(event({ status: 'completed' }));
    await renderEdit();

    expect(
      screen.getByText('Η εκδήλωση έχει ολοκληρωθεί και δεν μπορεί να τροποποιηθεί.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Αποθήκευση' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Δημοσίευση' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ακύρωση εκδήλωσης' })).not.toBeInTheDocument();
  });

  it('requires at least one category on save', async () => {
    serve(event());
    await renderEdit();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Μουσική' }));
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }));

    expect(await screen.findByText('Επιλέξτε τουλάχιστον μία κατηγορία.')).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('refuses to edit another organizer’s event', async () => {
    serve(event({ organizer_id: 'someone-else' }));
    renderWithProviders(<OrganizerEventEditPage />, { route, path });

    expect(
      await screen.findByText('Δεν έχετε δικαίωμα επεξεργασίας αυτής της εκδήλωσης.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Αποθήκευση' })).not.toBeInTheDocument();
  });

  it('rejects an id that is not a UUID without calling the API', async () => {
    renderWithProviders(<OrganizerEventEditPage />, { route: '/organizer/events/abc/edit', path });

    expect(await screen.findByText('Μη έγκυρο αναγνωριστικό εκδήλωσης.')).toBeInTheDocument();
    await waitFor(() => expect(api.matching('/events/abc')).toHaveLength(0));
  });
});
