import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { HeroSearch } from '@/components/home/HeroSearch';
import { event } from '@/tests/helpers/fixtures';
import { mockFetch, type MockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore } from '@/tests/helpers/renderWithProviders';

let api: MockFetch;

const events = [
  event({ id: 'ev-1', title: 'Συναυλία Ροκ', venue: 'Gazi Music Hall', city: 'Αθήνα' }),
  event({ id: 'ev-2', title: 'Συναυλία Τζαζ', venue: 'Half Note', city: 'Αθήνα' }),
  event({ id: 'ev-3', title: 'Συναυλία Έντεχνου', venue: 'Λυκαβηττός', city: 'Αθήνα' }),
  event({ id: 'ev-4', title: 'Συναυλία Κλασικής', venue: 'Μέγαρο', city: 'Αθήνα' }),
];

/** Shows where the router ended up, so navigation can be asserted. */
function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderSearch() {
  renderWithProviders(
    <Routes>
      <Route
        path="*"
        element={
          <>
            <HeroSearch />
            <Where />
          </>
        }
      />
    </Routes>,
  );
  return screen.getByRole('combobox');
}

async function type(input: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value } });
  });
}

const searches = () => api.matching('/events/search');

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  api = mockFetch({ '/events/search': () => events });
});

describe('HeroSearch', () => {
  it('waits for two characters before searching', async () => {
    const input = renderSearch();
    await type(input, 'Σ');
    await new Promise((r) => setTimeout(r, 400));
    expect(searches()).toHaveLength(0);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('debounces typing into a single request for at most three results', async () => {
    const input = renderSearch();
    await type(input, 'Συ');
    await type(input, 'Συν');
    await type(input, 'Συνα');

    await screen.findAllByRole('option');
    const list = screen.getByRole('listbox');
    expect(searches()).toHaveLength(1);
    const url = new URL(searches()[0].url);
    expect(url.searchParams.get('q')).toBe('Συνα');
    expect(url.searchParams.get('limit')).toBe('3');

    // The stub returns four; the box never shows more than three.
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Συναυλία Ροκ');
    expect(options[0]).toHaveTextContent('Gazi Music Hall, Αθήνα');
  });

  it('links each result to its event and offers the full results', async () => {
    const input = renderSearch();
    await type(input, 'ροκ');
    await screen.findAllByRole('option');
    const list = screen.getByRole('listbox');

    expect(within(list).getAllByRole('link')[0]).toHaveAttribute('href', '/events/ev-1');
    expect(screen.getByRole('link', { name: /ροκ/ })).toHaveAttribute(
      'href',
      '/events?q=%CF%81%CE%BF%CE%BA',
    );
  });

  it('says so when nothing matches', async () => {
    api.on('/events/search', () => []);
    const input = renderSearch();
    await type(input, 'xyz');
    expect(await screen.findByRole('status')).toHaveTextContent('xyz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('moves through the results with the arrow keys and opens the chosen one', async () => {
    const input = renderSearch();
    await type(input, 'Συναυλία');
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // wraps to the last
    expect(options[2]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/events/ev-3');
  });

  it('opens the full results on Enter when nothing is highlighted', async () => {
    const input = renderSearch();
    await type(input, 'Αθήνα');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/events?q=${encodeURIComponent('Αθήνα')}`,
    );
  });

  it('closes on Escape and on blur', async () => {
    const input = renderSearch();
    await type(input, 'Συναυλία');
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await type(input, 'Συναυλία Ρ');
    await screen.findAllByRole('option');
    fireEvent.blur(input);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });
});
