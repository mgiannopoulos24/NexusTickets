import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import MessagesPage from '@/pages/messages/MessagesPage';
import { useWebSocket } from '@/hooks/useWebSocket';
import { store } from '@/app/store';
import { markTyping } from '@/app/messagingSlice';
import { wsClient } from '@/utils/wsClient';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';
import type { Conversation, Message, MessageRecipient } from '@/types/message';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

const ME = 'u-1';
const ORG = 'org-1';
const ADMIN = 'adm-1';

const organizer: MessageRecipient = {
  id: ORG,
  username: 'organizer',
  full_name: 'Demo Organizer',
  role: 'organizer',
  support: false,
};

const support: MessageRecipient = {
  id: ADMIN,
  username: 'admin',
  full_name: 'Admin User',
  role: 'admin',
  support: true,
};

function message(over: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    sender_id: ORG,
    recipient_id: ME,
    subject: 'Σχετικά με την εκδήλωση',
    body: 'Καλώς ήρθατε!',
    read_at: null,
    created_at: '2026-03-01T10:00:00Z',
    sender: { id: ORG, username: 'organizer', full_name: 'Demo Organizer', role: 'organizer' },
    recipient: { id: ME, username: 'tester', full_name: 'Test User', role: 'attendee' },
    ...over,
  };
}

const conversation: Conversation = {
  user: { id: ORG, username: 'organizer', full_name: 'Demo Organizer', role: 'organizer' },
  support: false,
  last_message: message(),
  unread_count: 2,
};

const thread: Message[] = [
  message({ id: 'm-1', body: 'Καλώς ήρθατε!', created_at: '2026-03-01T10:00:00Z' }),
  message({
    id: 'm-2',
    sender_id: ME,
    recipient_id: ORG,
    subject: 'Απ: Σχετικά με την εκδήλωση',
    body: 'Ευχαριστώ πολύ!',
    created_at: '2026-03-01T10:05:00Z',
    read_at: '2026-03-01T10:06:00Z',
  }),
];

let api: MockFetch;
let sentFrames: { type: string; payload: unknown }[] = [];
/** Frame handlers the app registered, so a test can play the server's part. */
let subscribers: ((frame: unknown) => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  signIn({ id: ME, role: 'attendee' });
  // The socket is not open in a test, so capture what the page tries to send.
  sentFrames = [];
  vi.spyOn(wsClient, 'send').mockImplementation((envelope) => {
    sentFrames.push(envelope as { type: string; payload: unknown });
    return true;
  });
  subscribers = [];
  vi.spyOn(wsClient, 'connect').mockImplementation(() => {});
  vi.spyOn(wsClient, 'disconnect').mockImplementation(() => {});
  vi.spyOn(wsClient, 'subscribe').mockImplementation((sub) => {
    subscribers.push(sub as (frame: unknown) => void);
    return () => {
      subscribers = subscribers.filter((s) => s !== sub);
    };
  });
  api = mockFetch({
    '/messages/conversations': () => [conversation],
    '/messages/recipients': () => [organizer, support],
    '/messages/thread/': () => thread,
    '/messages/unread-count': () => ({ count: 2 }),
  });
});

/** AppShell owns the socket in the real app; mirror that around the page. */
function MessengerUnderTest() {
  useWebSocket();
  return <MessagesPage />;
}

async function renderMessenger(route = '/messages') {
  renderWithProviders(<MessengerUnderTest />, { route, browserRouter: true });
  await screen.findByRole('heading', { name: 'Μηνύματα' });
}

const posts = () => api.calls.filter((c) => c.method === 'POST' && c.url.endsWith('/messages'));

describe('Messenger sidebar', () => {
  it('lists each conversation with its last message and unread badge', async () => {
    await renderMessenger();
    const row = await screen.findByRole('button', { name: /Demo Organizer/ });
    expect(row).toHaveTextContent('Καλώς ήρθατε!');
    expect(row).toHaveTextContent('2');
    expect(row).toHaveTextContent('Διοργανωτής');
  });

  it('prompts to pick a thread before one is open', async () => {
    await renderMessenger();
    expect(screen.getByText('Επιλέξτε μια συνομιλία')).toBeInTheDocument();
  });

  it('filters the list by name or message text', async () => {
    await renderMessenger();
    await screen.findByRole('button', { name: /Demo Organizer/ });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Αναζήτηση συνομιλίας'), {
        target: { value: 'Καλώς' },
      });
    });
    expect(screen.getByRole('button', { name: /Demo Organizer/ })).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Αναζήτηση συνομιλίας'), {
        target: { value: 'δεν υπάρχει' },
      });
    });
    expect(screen.getByText('Καμία συνομιλία δεν ταιριάζει.')).toBeInTheDocument();
  });

  it('offers to start one when there are no threads yet', async () => {
    api.on('/messages/conversations', () => []);
    await renderMessenger();
    expect(await screen.findByText('Δεν υπάρχουν συνομιλίες ακόμη.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ξεκινήστε συνομιλία' })).toBeInTheDocument();
  });

  it('does not mark anything read just by listing the threads', async () => {
    await renderMessenger();
    await screen.findByRole('button', { name: /Demo Organizer/ });
    expect(api.matching('/messages/thread/')).toHaveLength(0);
  });
});

describe('Messenger thread', () => {
  async function openThread() {
    await renderMessenger();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Demo Organizer/ }));
    });
    await waitFor(() => expect(api.matching('/messages/thread/' + ORG).length).toBeGreaterThan(0));
  }

  it('loads the exchange when a conversation is opened', async () => {
    await openThread();
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });
    expect(within(transcript).getByText('Καλώς ήρθατε!')).toBeInTheDocument();
    expect(within(transcript).getByText('Ευχαριστώ πολύ!')).toBeInTheDocument();
  });

  it('puts the thread in the URL so it can be linked', async () => {
    await openThread();
    await waitFor(() => expect(window.location.search).toContain(`to=${ORG}`));
  });

  it('opens the thread named in the URL on load', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    await waitFor(() => expect(api.matching('/messages/thread/' + ORG).length).toBeGreaterThan(0));
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });
    expect(within(transcript).getByText('Καλώς ήρθατε!')).toBeInTheDocument();
  });

  it('shows the subject once per topic rather than on every bubble', async () => {
    await openThread();
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });
    // "Απ: <same subject>" is the same topic, so it is not repeated.
    expect(within(transcript).getAllByText('Σχετικά με την εκδήλωση')).toHaveLength(1);
  });

  it('marks a delivered message of mine as read', async () => {
    await openThread();
    expect(await screen.findByText('Αναγνωσμένο')).toBeInTheDocument();
  });

  it('says so when the thread is empty', async () => {
    api.on('/messages/thread/', () => []);
    await renderMessenger(`/messages?to=${ORG}`);
    expect(
      await screen.findByText('Δεν υπάρχουν μηνύματα ακόμη. Γράψτε το πρώτο.'),
    ).toBeInTheDocument();
  });
});

describe('Messenger composer', () => {
  it('sends on Enter and inherits the thread subject', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    const box = await screen.findByLabelText('Μήνυμα');

    await act(async () => {
      fireEvent.change(box, { target: { value: 'Τι ώρα ξεκινά;' } });
    });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter', shiftKey: false });
    });

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toEqual({
      recipient_id: ORG,
      subject: 'Απ: Σχετικά με την εκδήλωση',
      body: 'Τι ώρα ξεκινά;',
    });
  });

  it('leaves Shift+Enter for a line break', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    const box = await screen.findByLabelText('Μήνυμα');
    await act(async () => {
      fireEvent.change(box, { target: { value: 'πρώτη γραμμή' } });
      fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    });
    expect(posts()).toHaveLength(0);
  });

  it('will not send an empty message', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');
    expect(screen.getByRole('button', { name: 'Αποστολή' })).toBeDisabled();
  });

  it('asks for a subject only on a brand-new thread', async () => {
    api.on('/messages/thread/', () => []);
    await renderMessenger(`/messages?to=${ORG}`);
    const subject = await screen.findByLabelText('Θέμα');

    await act(async () => {
      fireEvent.change(subject, { target: { value: 'Ερώτηση' } });
      fireEvent.change(screen.getByLabelText('Μήνυμα'), { target: { value: 'Γεια σας' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Αποστολή' }));
    });

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({ subject: 'Ερώτηση', body: 'Γεια σας' });
  });

  it('translates the booking rule the server enforces', async () => {
    api.fail(/\/messages$/, 403, 'messaging requires a booking between the two users');
    await renderMessenger(`/messages?to=${ORG}`);
    const box = await screen.findByLabelText('Μήνυμα');

    await act(async () => {
      fireEvent.change(box, { target: { value: 'Γεια' } });
    });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Μπορείτε να στείλετε μήνυμα μόνο σε διοργανωτές/,
    );
  });
});

describe('Starting a conversation', () => {
  it('lists everyone reachable in the picker', async () => {
    await renderMessenger();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Νέα συνομιλία' }));
    });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Demo Organizer')).toBeInTheDocument();
    expect(within(dialog).getByText('Υποστήριξη')).toBeInTheDocument();
  });

  it('explains an empty recipient list as "book something first"', async () => {
    api.on('/messages/recipients', () => []);
    await renderMessenger();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Νέα συνομιλία' }));
    });
    expect(
      await screen.findByText(/Η επικοινωνία με διοργανωτή ανοίγει μετά από κράτηση/),
    ).toBeInTheDocument();
  });

  it('opens the picked person as a thread', async () => {
    api.on('/messages/conversations', () => []);
    await renderMessenger();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Νέα συνομιλία' }));
    });
    const dialog = await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByText('Demo Organizer'));
    });
    await waitFor(() => expect(window.location.search).toContain(`to=${ORG}`));
  });

  it('opens the support thread straight from ?compose=1&support=1', async () => {
    await renderMessenger('/messages?compose=1&support=1');
    await waitFor(() =>
      expect(api.matching('/messages/thread/' + ADMIN).length).toBeGreaterThan(0),
    );
    expect(await screen.findByText('Υποστήριξη')).toBeInTheDocument();
  });
});

describe('Emoji, GIFs, media and typing', () => {
  it('offers an emoji and a GIF picker in the composer', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');
    expect(screen.getByRole('button', { name: 'Εισαγωγή emoji' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Εισαγωγή GIF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Επισύναψη αρχείου' })).toBeEnabled();
  });

  it('uploads an attachment and sends it with the message', async () => {
    api.on('/messages/attachments', () => ({
      url: '/uploads/media/messages/u-1/pic.png',
      name: 'pic.png',
      kind: 'image',
      size: 2048,
    }));
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');

    const file = new File(['binary'], 'pic.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // The composer previews it before anything is sent.
    expect(await screen.findByText('pic.png')).toBeInTheDocument();
    expect(posts()).toHaveLength(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Αποστολή' }));
    });
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({
      image_url: '/uploads/media/messages/u-1/pic.png',
      body: '',
    });
  });

  it('sends a non-image as a named file attachment', async () => {
    api.on('/messages/attachments', () => ({
      url: '/uploads/media/messages/u-1/report.pdf',
      name: 'report.pdf',
      kind: 'file',
      size: 5000,
    }));
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');

    const file = new File(['%PDF'], 'report.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await screen.findByText('report.pdf');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Αποστολή' }));
    });
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({
      file_url: '/uploads/media/messages/u-1/report.pdf',
      file_name: 'report.pdf',
    });
  });

  it('reports a failed upload without sending anything', async () => {
    api.fail('/messages/attachments', 400, 'attachment is larger than 10MB');
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');

    const file = new File(['x'], 'huge.bin');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/10MB/);
    expect(posts()).toHaveLength(0);
  });

  it('renders an image, a GIF and a file in the transcript', async () => {
    api.on('/messages/thread/', () => [
      message({ id: 'a', body: '', image_url: '/uploads/media/x.png' }),
      message({ id: 'b', body: '', gif_url: 'https://media.giphy.com/x.gif' }),
      message({ id: 'c', body: '', file_url: '/uploads/media/y.pdf', file_name: 'y.pdf' }),
    ]);
    await renderMessenger(`/messages?to=${ORG}`);
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });

    expect(within(transcript).getByAltText('Συνημμένη εικόνα')).toHaveAttribute(
      'src',
      '/uploads/media/x.png',
    );
    expect(within(transcript).getByAltText('GIF')).toHaveAttribute(
      'src',
      'https://media.giphy.com/x.gif',
    );
    const download = within(transcript).getByText('y.pdf').closest('a');
    expect(download).toHaveAttribute('href', '/uploads/media/y.pdf');
    expect(download).toHaveAttribute('download', 'y.pdf');
  });

  it('shows the typing dots while the other side is composing', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');
    expect(screen.queryByRole('status', { name: 'Γράφει…' })).not.toBeInTheDocument();

    await act(async () => {
      store.dispatch(markTyping({ userId: ORG, at: Date.now() }));
    });
    expect(await screen.findByRole('status', { name: 'Γράφει…' })).toBeInTheDocument();
  });

  it('ignores a hint that has already gone stale', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');
    await act(async () => {
      store.dispatch(markTyping({ userId: ORG, at: Date.now() - 60_000 }));
    });
    expect(screen.queryByRole('status', { name: 'Γράφει…' })).not.toBeInTheDocument();
  });

  it('ignores a typing hint aimed at a different thread', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');
    await act(async () => {
      store.dispatch(markTyping({ userId: ADMIN, at: Date.now() }));
    });
    expect(screen.queryByRole('status', { name: 'Γράφει…' })).not.toBeInTheDocument();
  });

  it('announces our own typing over the socket, throttled', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    const box = await screen.findByLabelText('Μήνυμα');

    await act(async () => {
      fireEvent.change(box, { target: { value: 'γ' } });
      fireEvent.change(box, { target: { value: 'γε' } });
      fireEvent.change(box, { target: { value: 'γει' } });
    });

    const typingFrames = sentFrames.filter((f) => f.type === 'typing');
    expect(typingFrames).toHaveLength(1);
    expect(typingFrames[0].payload).toEqual({ recipient_id: ORG });
  });
});

describe('Real-time delivery', () => {
  /** Pushes a frame the way the server does, through the shared ws client. */
  function pushFrame(frame: { type: string; payload: unknown }) {
    for (const sub of subscribers) sub(frame as never);
  }

  it('appends an incoming message to the open thread without a refetch', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });
    const before = api.matching('/messages/thread/').length;

    await act(async () => {
      pushFrame({
        type: 'new_message',
        payload: {
          id: 'live-1',
          sender_id: ORG,
          recipient_id: ME,
          subject: 'Απ: Σχετικά με την εκδήλωση',
          body: 'Μόλις έφτασε',
          created_at: '2026-03-01T11:00:00Z',
        },
      });
    });

    expect(await within(transcript).findByText('Μόλις έφτασε')).toBeInTheDocument();
    // Connectify appends rather than refetching; so do we.
    expect(api.matching('/messages/thread/')).toHaveLength(before);
  });

  it('renders media that arrives over the socket', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });

    await act(async () => {
      pushFrame({
        type: 'new_message',
        payload: {
          id: 'live-2',
          sender_id: ORG,
          recipient_id: ME,
          subject: 'Φωτογραφία',
          body: '',
          image_url: '/uploads/media/live.png',
          created_at: '2026-03-01T11:05:00Z',
        },
      });
    });

    expect(await within(transcript).findByAltText('Συνημμένη εικόνα')).toHaveAttribute(
      'src',
      '/uploads/media/live.png',
    );
  });

  it('ignores a duplicate push for a message already in the thread', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });

    const frame = {
      type: 'new_message',
      payload: {
        id: 'live-3',
        sender_id: ORG,
        recipient_id: ME,
        subject: 'Απ: Σχετικά με την εκδήλωση',
        body: 'Διπλό',
        created_at: '2026-03-01T11:10:00Z',
      },
    };
    await act(async () => {
      pushFrame(frame);
      pushFrame(frame);
    });

    expect(within(transcript).getAllByText('Διπλό')).toHaveLength(1);
  });

  it('shows our own sent message straight away', async () => {
    api.on('/messages', () =>
      message({ id: 'mine-1', sender_id: ME, recipient_id: ORG, body: 'Στάλθηκε' }),
    );
    await renderMessenger(`/messages?to=${ORG}`);
    const box = await screen.findByLabelText('Μήνυμα');

    await act(async () => {
      fireEvent.change(box, { target: { value: 'Στάλθηκε' } });
    });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });

    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });
    expect(await within(transcript).findByText('Στάλθηκε')).toBeInTheDocument();
  });

  it('turns a typing frame into the dots', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');

    await act(async () => {
      pushFrame({ type: 'typing', payload: { user_id: ORG } });
    });

    expect(await screen.findByRole('status', { name: 'Γράφει…' })).toBeInTheDocument();
  });

  it('clears the dots when their message lands', async () => {
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByLabelText('Μήνυμα');

    await act(async () => {
      pushFrame({ type: 'typing', payload: { user_id: ORG } });
    });
    expect(screen.getByRole('status', { name: 'Γράφει…' })).toBeInTheDocument();

    await act(async () => {
      pushFrame({
        type: 'new_message',
        payload: {
          id: 'live-4',
          sender_id: ORG,
          recipient_id: ME,
          subject: 'Απ: Σχετικά με την εκδήλωση',
          body: 'Ορίστε',
          created_at: '2026-03-01T11:20:00Z',
        },
      });
    });
    expect(screen.queryByRole('status', { name: 'Γράφει…' })).not.toBeInTheDocument();
  });
});

describe('Deleting, reacting and replying', () => {
  it('shows a tombstone both sides can see instead of hiding the message', async () => {
    api.on('/messages/thread/', () => [
      message({ id: 'gone', body: '', deleted: true }),
      message({ id: 'kept', body: 'ακόμη εδώ' }),
    ]);
    await renderMessenger(`/messages?to=${ORG}`);
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });

    expect(within(transcript).getByText('Το μήνυμα διαγράφηκε')).toBeInTheDocument();
    expect(within(transcript).getByText('ακόμη εδώ')).toBeInTheDocument();
  });

  it('offers no actions on a withdrawn message', async () => {
    api.on('/messages/thread/', () => [message({ id: 'gone', body: '', deleted: true })]);
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByText('Το μήνυμα διαγράφηκε');

    expect(screen.queryByRole('button', { name: 'Απάντηση στο μήνυμα' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Αντίδραση' })).not.toBeInTheDocument();
  });

  it('only offers delete on our own messages', async () => {
    api.on('/messages/thread/', () => [
      message({ id: 'theirs', sender_id: ORG, body: 'δικό τους' }),
    ]);
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByText('δικό τους');

    expect(screen.queryByRole('button', { name: 'Διαγραφή μηνύματος' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Απάντηση στο μήνυμα' })).toBeInTheDocument();
  });

  it('withdraws our own message for everyone', async () => {
    api.on('/messages/thread/', () => [
      message({ id: 'mine', sender_id: ME, recipient_id: ORG, body: 'δικό μου' }),
    ]);
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByText('δικό μου');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Διαγραφή μηνύματος' }));
    });

    await waitFor(() => {
      const deletes = api.calls.filter((c) => c.method === 'DELETE');
      expect(deletes).toHaveLength(1);
      expect(deletes[0].url).toContain('/messages/mine');
    });
    expect(toasts.success).toHaveBeenCalledWith('Το μήνυμα αποσύρθηκε και για τους δύο.');
  });

  it('renders reaction chips and marks our own', async () => {
    api.on('/messages/thread/', () => [
      message({
        id: 'r1',
        body: 'γεια',
        reactions: [
          { emoji: '👍', count: 2, mine: true },
          { emoji: '🎉', count: 1, mine: false },
        ],
      }),
    ]);
    await renderMessenger(`/messages?to=${ORG}`);

    const mine = await screen.findByRole('button', { name: '👍 2' });
    expect(mine).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '🎉 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles a reaction off by tapping our own chip', async () => {
    api.on('/messages/thread/', () => [
      message({ id: 'r1', body: 'γεια', reactions: [{ emoji: '👍', count: 1, mine: true }] }),
    ]);
    await renderMessenger(`/messages?to=${ORG}`);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: '👍 1' }));
    });

    await waitFor(() => {
      const posts = api.calls.filter((c) => c.url.includes('/reactions') && c.method === 'POST');
      expect(posts).toHaveLength(1);
      expect(posts[0].body).toEqual({ emoji: '👍' });
    });
  });

  it('adds a reaction from the quick picker', async () => {
    api.on('/messages/thread/', () => [message({ id: 'r2', body: 'γεια' })]);
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByText('γεια');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Αντίδραση' }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Αντίδραση ❤️' }));
    });

    await waitFor(() => {
      const posts = api.calls.filter((c) => c.url.includes('/reactions') && c.method === 'POST');
      expect(posts[0].body).toEqual({ emoji: '❤️' });
    });
  });

  it('quotes the message being replied to and sends the link', async () => {
    api.on('/messages/thread/', () => [
      message({ id: 'orig', sender_id: ORG, body: 'η ερώτηση' }),
    ]);
    api.on('/messages', () => message({ id: 'reply-1', sender_id: ME, recipient_id: ORG }));
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByText('η ερώτηση');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Απάντηση στο μήνυμα' }));
    });
    // The composer shows what is being answered.
    expect(await screen.findByText('Απάντηση σε')).toBeInTheDocument();

    const box = screen.getByLabelText('Μήνυμα');
    await act(async () => {
      fireEvent.change(box, { target: { value: 'η απάντηση' } });
    });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({ reply_to_id: 'orig', body: 'η απάντηση' });
  });

  it('lets the reply be cancelled before sending', async () => {
    api.on('/messages/thread/', () => [message({ id: 'orig', sender_id: ORG, body: 'η ερώτηση' })]);
    await renderMessenger(`/messages?to=${ORG}`);
    await screen.findByText('η ερώτηση');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Απάντηση στο μήνυμα' }));
    });
    await screen.findByText('Απάντηση σε');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ακύρωση απάντησης' }));
    });
    expect(screen.queryByText('Απάντηση σε')).not.toBeInTheDocument();
  });

  it('shows the quote above a reply in the transcript', async () => {
    api.on('/messages/thread/', () => [
      message({ id: 'orig', sender_id: ORG, body: 'η ερώτηση' }),
      message({
        id: 'rep',
        sender_id: ME,
        recipient_id: ORG,
        body: 'η απάντηση',
        reply_to: { id: 'orig', sender_id: ORG, body: 'η ερώτηση', deleted: false },
      }),
    ]);
    await renderMessenger(`/messages?to=${ORG}`);
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });

    const quote = within(transcript).getByText('η ερώτηση', { selector: 'blockquote span' });
    expect(quote).toBeInTheDocument();
    expect(within(transcript).getByText('Demo Organizer')).toBeInTheDocument();
  });

  it('says so when the quoted message has since been withdrawn', async () => {
    api.on('/messages/thread/', () => [
      message({
        id: 'rep',
        sender_id: ME,
        recipient_id: ORG,
        body: 'η απάντηση',
        reply_to: { id: 'orig', sender_id: ORG, body: '', deleted: true },
      }),
    ]);
    await renderMessenger(`/messages?to=${ORG}`);
    const transcript = await screen.findByRole('list', { name: 'Μηνύματα συνομιλίας' });
    expect(within(transcript).getByText('Το μήνυμα διαγράφηκε')).toBeInTheDocument();
  });
});
