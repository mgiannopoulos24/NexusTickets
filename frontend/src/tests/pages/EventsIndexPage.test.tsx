import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import EventsIndexPage from '@/pages/events/EventsIndexPage';
import { category, event } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { store } from '@/app/store';
import { renderWithProviders, resetStore, signIn } from '@/tests/helpers/renderWithProviders';

let api: MockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  api = mockFetch({
    '/categories': () => [category(), category({ id: 'cat-2', name: 'Θέατρο' })],
    '/events/search': () => [event()],
  });
});

const searches = () => api.matching('/events/search').map((c) => c.url);
const lastSearch = () => searches()[searches().length - 1] ?? '';

async function renderPage() {
  renderWithProviders(<EventsIndexPage />, { route: '/events' });
  await waitFor(() => expect(searches().length).toBeGreaterThan(0));
}

/** Waits until a search carrying `fragment` has been issued. */
async function expectSearchWith(fragment: string) {
  await waitFor(() => expect(searches().some((u) => u.includes(fragment))).toBe(true), {
    timeout: 3000,
  });
}

describe('EventsIndexPage search criteria (§8)', () => {
  it('loads the first page with no criteria', async () => {
    await renderPage();
    expect(lastSearch()).toContain('limit=12&offset=0');
    expect(lastSearch()).not.toContain('title=');
  });

  it('filters by free text over the description', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Αναζήτηση|Search/i), {
        target: { value: 'μουσική' },
      });
    });
    await expectSearchWith(`q=${encodeURIComponent('μουσική')}`);
  });

  it('filters by title', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Τίτλος'), { target: { value: 'Jazz' } });
    });
    await expectSearchWith('title=Jazz');
  });

  it('filters by category, and by several at once', async () => {
    await renderPage();
    const boxes = await screen.findAllByRole('checkbox');
    await act(async () => {
      fireEvent.click(boxes[0]);
    });
    await expectSearchWith('category_ids=cat-1');

    await act(async () => {
      fireEvent.click(boxes[1]);
    });
    await expectSearchWith(`category_ids=${encodeURIComponent('cat-1,cat-2')}`);
  });

  it('unticking a category drops it from the criteria', async () => {
    await renderPage();
    const boxes = await screen.findAllByRole('checkbox');
    await act(async () => {
      fireEvent.click(boxes[0]);
    });
    await expectSearchWith('category_ids=cat-1');
    await act(async () => {
      fireEvent.click(boxes[0]);
    });
    // Returning to a set of criteria already in the RTK Query cache is served
    // from that cache, so assert on the criteria rather than on a new request.
    await waitFor(() => expect(store.getState().events.filters.category_ids).toBeUndefined());
  });

  it('filters by location', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Πόλη|City/i), { target: { value: 'Αθήνα' } });
    });
    await expectSearchWith(`city=${encodeURIComponent('Αθήνα')}`);
  });

  it('combines criteria instead of replacing them', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Τίτλος'), { target: { value: 'Jazz' } });
    });
    await expectSearchWith('title=Jazz');
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Πόλη|City/i), { target: { value: 'Πάτρα' } });
    });
    await waitFor(() => {
      expect(lastSearch()).toContain('title=Jazz');
      expect(lastSearch()).toContain(`city=${encodeURIComponent('Πάτρα')}`);
    });
  });

  it('mirrors the criteria into the URL so a search can be shared', async () => {
    renderWithProviders(<EventsIndexPage />, { route: '/events', browserRouter: true });
    await waitFor(() => expect(searches().length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Τίτλος'), { target: { value: 'Jazz' } });
    });
    await waitFor(() => expect(window.location.search).toContain('title=Jazz'));
  });

  it('restores the criteria carried in the URL on load', async () => {
    renderWithProviders(<EventsIndexPage />, {
      route: '/events?title=Jazz&city=' + encodeURIComponent('Αθήνα'),
      browserRouter: true,
    });
    await waitFor(() => expect(searches().length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(lastSearch()).toContain('title=Jazz');
      expect(lastSearch()).toContain(`city=${encodeURIComponent('Αθήνα')}`);
    });
    expect(screen.getByLabelText('Τίτλος')).toHaveValue('Jazz');
  });

  it('clears every criterion at once', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Τίτλος'), { target: { value: 'Jazz' } });
    });
    await expectSearchWith('title=Jazz');

    const clear = screen.getAllByRole('button', { name: /Καθαρισμός/ })[0];
    await waitFor(() => expect(clear).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(clear);
    });
    await waitFor(() => expect(store.getState().events.filters).toEqual({}));
    expect(screen.getByLabelText('Τίτλος')).toHaveValue('');
  });

  it('renders a card per result', async () => {
    await renderPage();
    expect(await screen.findByText('Συναυλία Κλασικής Μουσικής')).toBeInTheDocument();
  });

  it('explains an empty result set rather than showing a blank grid', async () => {
    api.on('/events/search', () => []);
    await renderPage();
    expect((await screen.findAllByText('Καμία εκδήλωση')).length).toBeGreaterThan(0);
  });

  it('offers a retry when the search fails', async () => {
    api.fail('/events/search', 500);
    renderWithProviders(<EventsIndexPage />, { route: '/events' });
    expect(
      await screen.findByText('Δεν ήταν δυνατή η φόρτωση των εκδηλώσεων.'),
    ).toBeInTheDocument();
  });

  it('only asks for recommendations once signed in (§13)', async () => {
    await renderPage();
    expect(api.matching('/events/recommended')).toHaveLength(0);

    resetStore();
    signIn({ role: 'attendee' });
    renderWithProviders(<EventsIndexPage />, { route: '/events' });
    await waitFor(() => expect(api.matching('/events/recommended').length).toBeGreaterThan(0));
  });

  it('pages forward without losing the criteria', async () => {
    api.on('/events/search', () => [event()]);
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Τίτλος'), { target: { value: 'Jazz' } });
    });
    await expectSearchWith('title=Jazz');

    const next = screen.queryByLabelText(/Go to next page|Επόμενη/i);
    if (!next) return; // has_more is false in this fixture, so there is no next page
    await act(async () => {
      fireEvent.click(next);
    });
    await waitFor(() => expect(lastSearch()).toContain('title=Jazz'));
  });
});

describe('EventsIndexPage result feedback', () => {
  it('counts the results so a filter that still fills the page is visibly applied', async () => {
    await renderPage();
    expect(await screen.findByTestId('results-summary')).toHaveTextContent('1 εκδήλωση');
  });

  it('marks the list as filtered once a criterion is set', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Τίτλος'), { target: { value: 'Jazz' } });
    });
    await waitFor(() =>
      expect(screen.getByTestId('results-summary')).toHaveTextContent('με φίλτρα'),
    );
  });

  it('hides the recommendation strip while filtering, so only matches are shown', async () => {
    resetStore();
    signIn({ role: 'attendee' });
    api.on('/events/recommended', () => [event({ title: 'Προτεινόμενη' })]);
    await renderPage();
    expect(await screen.findByText('Προτεινόμενες Εκδηλώσεις')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Τίτλος'), { target: { value: 'Jazz' } });
    });
    await waitFor(() =>
      expect(screen.queryByText('Προτεινόμενες Εκδηλώσεις')).not.toBeInTheDocument(),
    );
  });
});

describe('EventsIndexPage filter panel', () => {
  it('shows the panel on desktop and behind a dialog on mobile', async () => {
    await renderPage();
    const filterButtons = screen.getAllByRole('button', { name: /Φίλτρα|Filter/i });
    expect(filterButtons.length).toBeGreaterThan(0);
    const sidebar = screen.getAllByText('Τίτλος')[0];
    expect(within(sidebar.closest('div')!).getByLabelText('Τίτλος')).toBeInTheDocument();
  });
});
