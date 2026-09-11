import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import MessagesPage from '@/pages/messages/MessagesPage';
import { setUnreadCount } from '@/app/messagingSlice';
import { store } from '@/app/store';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';
import type { Message, MessageRecipient } from '@/types/message';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

const ME = 'u-1';
const ORG = 'org-1';

const organizer: MessageRecipient = {
  id: ORG,
  username: 'organizer',
  full_name: 'Demo Organizer',
  role: 'organizer',
};

const attendee2: MessageRecipient = {
  id: 'u-2',
  username: 'maria',
  full_name: 'Maria Papadopoulou',
  role: 'attendee',
};

function message(over: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    sender_id: ORG,
    recipient_id: ME,
    event_id: null,
    subject: 'Σχετικά με την εκδήλωση',
    body: 'Καλώς ήρθατε!',
    read_at: null,
    created_at: '2026-03-01T10:00:00Z',
    sender: { id: ORG, username: 'organizer', full_name: 'Demo Organizer', role: 'organizer' },
    recipient: { id: ME, username: 'tester', full_name: 'Test User', role: 'attendee' },
    ...over,
  };
}

/** A folder page in the server's envelope, with pagination meta. */
function folder(messages: Message[], total = messages.length, limit = 20, offset = 0) {
  return { data: messages, meta: { total, limit, offset } };
}

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  store.dispatch(setUnreadCount(0));
  signIn({ id: ME, role: 'attendee' });
  api = mockFetch({
    '/messages/recipients': [organizer, attendee2],
    '/messages/inbox': folder([]),
    '/messages/sent': folder([]),
  });
});

describe('MessagesPage (§10) — folders', () => {
  it('opens on the inbox and lists received messages with an unread mark', async () => {
    api.on('/messages/inbox', () =>
      folder([
        message({ id: 'm-1', subject: 'Νέο', read_at: null }),
        message({ id: 'm-2', subject: 'Παλιό', read_at: '2026-03-01T12:00:00Z' }),
      ]),
    );
    renderWithProviders(<MessagesPage />, { route: '/messages' });

    expect(await screen.findByRole('link', { name: 'Νέο' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Παλιό' })).toBeInTheDocument();

    const rows = screen.getAllByTestId('mailbox-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-unread', 'true');
    expect(rows[1]).not.toHaveAttribute('data-unread');
    expect(within(rows[0]).getByRole('img', { name: 'Νέο μήνυμα' })).toBeInTheDocument();
    // The column shows the sender for the inbox.
    expect(within(rows[0]).getByText('Demo Organizer')).toBeInTheDocument();
    expect(screen.getByText('1–2 από 2')).toBeInTheDocument();

    // Listing must not touch anything on the server besides the folder read.
    expect(api.matching('/messages/inbox')).toHaveLength(1);
    expect(api.calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('switches to the sent folder and shows recipients', async () => {
    api.on('/messages/sent', () =>
      folder([
        message({
          id: 's-1',
          sender_id: ME,
          recipient_id: ORG,
          subject: 'Ερώτηση',
          sender: { id: ME, username: 'tester', full_name: 'Test User', role: 'attendee' },
          recipient: {
            id: ORG,
            username: 'organizer',
            full_name: 'Demo Organizer',
            role: 'organizer',
          },
        }),
      ]),
    );
    renderWithProviders(<MessagesPage />, { route: '/messages?folder=sent' });

    const row = await screen.findByTestId('mailbox-row');
    expect(within(row).getByRole('link', { name: 'Ερώτηση' })).toBeInTheDocument();
    expect(within(row).getByText('Demo Organizer')).toBeInTheDocument();
    // Sent items never carry the "new" mark.
    expect(row).not.toHaveAttribute('data-unread');
    expect(screen.getByRole('link', { name: /Απεσταλμένα/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the unread total on the inbox folder', async () => {
    store.dispatch(setUnreadCount(3));
    renderWithProviders(<MessagesPage />, { route: '/messages' });
    expect(await screen.findByLabelText('3 μη αναγνωσμένα')).toBeInTheDocument();
  });

  it('pages through a long folder', async () => {
    api.on('/messages/inbox', (url) => {
      const offset = Number(new URL(url, 'http://x').searchParams.get('offset') ?? 0);
      return folder(
        [message({ id: `m-${offset}`, subject: `Σελίδα ${offset === 0 ? 1 : 2}` })],
        25,
        20,
        offset,
      );
    });
    renderWithProviders(<MessagesPage />, { route: '/messages' });

    expect(await screen.findByRole('link', { name: 'Σελίδα 1' })).toBeInTheDocument();
    expect(screen.getByText('1–1 από 25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Προηγούμενη σελίδα' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Επόμενη σελίδα' }));

    expect(await screen.findByRole('link', { name: 'Σελίδα 2' })).toBeInTheDocument();
    expect(api.matching('offset=20')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Επόμενη σελίδα' })).toBeDisabled();
  });

  it('shows an empty state per folder', async () => {
    renderWithProviders(<MessagesPage />, { route: '/messages' });
    expect(await screen.findByText('Δεν έχετε εισερχόμενα')).toBeInTheDocument();
  });
});

describe('MessagesPage (§10) — opening a message', () => {
  it('renders the full message, its event, and the reply / delete actions', async () => {
    api.on('/messages/m-1', () =>
      message({
        id: 'm-1',
        read_at: '2026-03-01T10:05:00Z',
        event_id: 'ev-1',
        event: { id: 'ev-1', title: 'Συναυλία' },
        body: 'Πρώτη γραμμή\nΔεύτερη γραμμή',
      }),
    );
    renderWithProviders(<MessagesPage />, { route: '/messages?folder=inbox&id=m-1' });

    expect(
      await screen.findByRole('heading', { name: 'Σχετικά με την εκδήλωση' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Πρώτη γραμμή/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Συναυλία' })).toHaveAttribute('href', '/events/ev-1');
    expect(screen.getByRole('button', { name: /Απάντηση/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Διαγραφή/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Εισερχόμενα/ }).length).toBeGreaterThanOrEqual(2);
  });

  it('does not offer a reply on a sent message', async () => {
    api.on('/messages/s-1', () =>
      message({ id: 's-1', sender_id: ME, recipient_id: ORG, read_at: null }),
    );
    renderWithProviders(<MessagesPage />, { route: '/messages?folder=sent&id=s-1' });

    await screen.findByRole('heading', { name: 'Σχετικά με την εκδήλωση' });
    expect(screen.queryByRole('button', { name: /Απάντηση/ })).not.toBeInTheDocument();
  });

  it('reply opens the composer addressed to the sender with a Re: subject', async () => {
    api.on('/messages/m-1', () => message({ id: 'm-1', event_id: 'ev-1' }));
    renderWithProviders(<MessagesPage />, { route: '/messages?folder=inbox&id=m-1' });

    fireEvent.click(await screen.findByRole('button', { name: /Απάντηση/ }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Παραλήπτης')).toHaveValue(ORG));
    expect(within(dialog).getByLabelText('Θέμα')).toHaveValue('Re: Σχετικά με την εκδήλωση');

    fireEvent.change(within(dialog).getByLabelText('Μήνυμα'), {
      target: { value: 'Ευχαριστώ!' },
    });
    api.on('/messages', () => message({ id: 'm-9' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή' }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Το μήνυμα στάλθηκε.'));
    const post = api.calls.find((c) => c.method === 'POST' && c.url.endsWith('/messages'));
    expect(post?.body).toMatchObject({
      recipient_id: ORG,
      subject: 'Re: Σχετικά με την εκδήλωση',
      body: 'Ευχαριστώ!',
      event_id: 'ev-1',
    });
  });

  it('deletes from the current folder after confirmation and returns to the list', async () => {
    api.on('/messages/m-1', () => message({ id: 'm-1' }));
    renderWithProviders(<MessagesPage />, { route: '/messages?folder=inbox&id=m-1' });

    fireEvent.click(await screen.findByRole('button', { name: /Διαγραφή/ }));
    const dialog = await screen.findByRole('dialog');
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Διαγραφή' }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Το μήνυμα διαγράφηκε.'));
    const del = api.calls.find((c) => c.method === 'DELETE');
    expect(del?.url).toContain('/messages/m-1');
    // Back on the (now empty) inbox.
    expect(await screen.findByText('Δεν έχετε εισερχόμενα')).toBeInTheDocument();
  });
});

describe('MessagesPage (§10) — composing', () => {
  it('lists exactly the booking contacts the server allows', async () => {
    renderWithProviders(<MessagesPage />, { route: '/messages' });
    fireEvent.click(await screen.findByRole('button', { name: /Νέο μήνυμα/ }));

    const select = await screen.findByLabelText('Παραλήπτης');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options[1]).toBe('Demo Organizer — Διοργανωτής');
    expect(options[2]).toBe('Maria Papadopoulou — Συμμετέχων');
  });

  it('preselects the organizer and event from a booking link', async () => {
    renderWithProviders(<MessagesPage />, {
      route: `/messages?compose=1&to=${ORG}&event=ev-1&subject=${encodeURIComponent('Σχετικά με: Συναυλία')}`,
    });
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Παραλήπτης')).toHaveValue(ORG));
    expect(within(dialog).getByLabelText('Θέμα')).toHaveValue('Σχετικά με: Συναυλία');
  });

  it('validates before sending', async () => {
    renderWithProviders(<MessagesPage />, { route: '/messages?compose=1' });
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Επιλέξτε παραλήπτη.');
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('explains the booking rule when the server refuses', async () => {
    api.fail(/\/messages$/, 403, 'messaging requires a booking between the two users');
    renderWithProviders(<MessagesPage />, { route: `/messages?compose=1&to=${ORG}` });
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Παραλήπτης')).toHaveValue(ORG));

    fireEvent.change(within(dialog).getByLabelText('Θέμα'), { target: { value: 'Γεια' } });
    fireEvent.change(within(dialog).getByLabelText('Μήνυμα'), { target: { value: 'Ερώτηση' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/μοιράζεστε κράτηση/);
  });

  it('lands on the sent folder after a successful send', async () => {
    api.on('/messages', () => message({ id: 'm-9', sender_id: ME, recipient_id: ORG }));
    renderWithProviders(<MessagesPage />, { route: `/messages?compose=1&to=${ORG}` });
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Παραλήπτης')).toHaveValue(ORG));

    fireEvent.change(within(dialog).getByLabelText('Θέμα'), { target: { value: 'Γεια' } });
    fireEvent.change(within(dialog).getByLabelText('Μήνυμα'), { target: { value: 'Ερώτηση' } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Αποστολή' }));
    });

    await waitFor(() => expect(toasts.success).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Απεσταλμένα/ })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
