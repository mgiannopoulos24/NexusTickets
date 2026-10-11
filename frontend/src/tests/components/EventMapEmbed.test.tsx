import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { EventMapEmbed } from '@/components/events/EventMapEmbed';
import { resetGeocodeCache } from '@/lib/geocode';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

let fetchMock: ReturnType<typeof vi.fn>;

function answer(body: unknown) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
  );
}

const markers = (container: HTMLElement) => container.querySelectorAll('.leaflet-marker-icon');

beforeEach(() => {
  resetGeocodeCache();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('EventMapEmbed', () => {
  it('pins the coordinates when it has them, without geocoding', () => {
    const { container } = renderWithProviders(
      <EventMapEmbed latitude={37.97} longitude={23.72} address={{ city: 'Αθήνα' }} />,
    );
    expect(markers(container)).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Κατά προσέγγιση/)).not.toBeInTheDocument();
  });

  it('falls back to the address when there are no coordinates', async () => {
    answer([{ lat: '37.9757', lon: '23.7344' }]);
    const { container } = renderWithProviders(
      <EventMapEmbed
        latitude={null}
        longitude={null}
        address={{ address: 'Μέγαρο Μουσικής', city: 'Αθήνα', country: 'GR' }}
      />,
    );
    expect(screen.getByText('Εντοπισμός της τοποθεσίας στον χάρτη…')).toBeInTheDocument();

    await waitFor(() => expect(markers(container)).toHaveLength(1));
    expect(screen.getByText('Κατά προσέγγιση θέση, από τη διεύθυνση')).toBeInTheDocument();
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('q')).toBe('Μέγαρο Μουσικής, Αθήνα, GR');
  });

  it('says so when the address cannot be found', async () => {
    answer([]);
    renderWithProviders(<EventMapEmbed address={{ city: 'Ατλαντίδα' }} />);
    expect(await screen.findByText('Η τοποθεσία δεν βρέθηκε στον χάρτη.')).toBeInTheDocument();
  });

  it('says so when it has neither coordinates nor an address', () => {
    renderWithProviders(<EventMapEmbed />);
    expect(screen.getByText('Η τοποθεσία δεν βρέθηκε στον χάρτη.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
