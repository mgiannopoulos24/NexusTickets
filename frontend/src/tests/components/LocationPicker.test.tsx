import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { LocationPicker, type LocationValue } from '@/components/events/LocationPicker';
import { resetGeocodeCache } from '@/lib/geocode';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

type Route = (url: URL) => unknown;
let route: Route;
let fetchMock: ReturnType<typeof vi.fn>;

const nominatim = (path: string) =>
  fetchMock.mock.calls
    .map(([u]) => new URL(String(u)))
    .filter((u) => u.hostname === 'nominatim.openstreetmap.org' && u.pathname === path);

let latest: LocationValue;

function Harness({ initial }: { initial: Partial<LocationValue> }) {
  const [value, setValue] = useState<LocationValue>({
    address: '',
    city: '',
    country: '',
    latitude: '',
    longitude: '',
    ...initial,
  });
  latest = value;
  return (
    <>
      <input
        aria-label="address"
        value={value.address}
        onChange={(e) => setValue((v) => ({ ...v, address: e.target.value }))}
      />
      <LocationPicker value={value} onChange={(p) => setValue((v) => ({ ...v, ...p }))} />
    </>
  );
}

beforeEach(() => {
  resetGeocodeCache();
  route = () => [];
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const body = route(new URL(String(input)));
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('LocationPicker', () => {
  it('places the pin from the address alone', async () => {
    route = (u) => (u.pathname === '/search' ? [{ lat: '37.9715', lon: '23.7267' }] : []);
    renderWithProviders(<Harness initial={{ city: 'Αθήνα' }} />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('address'), { target: { value: 'Ακρόπολη' } });
    });
    await waitFor(() => expect(latest.latitude).toBe('37.9715'), { timeout: 3000 });
    expect(latest.longitude).toBe('23.7267');
    expect(nominatim('/search')[0].searchParams.get('q')).toBe('Ακρόπολη, Αθήνα');
  });

  it('keeps the address-derived pin in step with later edits', async () => {
    route = (u) =>
      u.searchParams.get('q')?.startsWith('Πλάκα')
        ? [{ lat: '37.97', lon: '23.73' }]
        : [{ lat: '37.98', lon: '23.72' }];
    renderWithProviders(<Harness initial={{ address: 'Ψυρρή', city: 'Αθήνα' }} />);
    await waitFor(() => expect(latest.latitude).toBe('37.98'), { timeout: 3000 });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('address'), { target: { value: 'Πλάκα' } });
    });
    await waitFor(() => expect(latest.latitude).toBe('37.97'), { timeout: 4000 });
  });

  it('does not move coordinates the user set by hand', async () => {
    route = () => [{ lat: '1', lon: '1' }];
    renderWithProviders(
      <Harness initial={{ city: 'Αθήνα', latitude: '37.5', longitude: '23.5' }} />,
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText('address'), { target: { value: 'Ερμού 1' } });
      await new Promise((r) => setTimeout(r, 1200));
    });
    expect(nominatim('/search')).toHaveLength(0);
    expect(latest.latitude).toBe('37.5');
  });

  it('finds the address on demand, replacing hand-set coordinates', async () => {
    route = () => [{ lat: '40.6264', lon: '22.9484' }];
    renderWithProviders(
      <Harness initial={{ address: 'Λευκός Πύργος', latitude: '1', longitude: '1' }} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Εύρεση στον χάρτη' }));
    });
    await waitFor(() => expect(latest.latitude).toBe('40.6264'));
    expect(latest.longitude).toBe('22.9484');
  });

  it('says so when the address is not on the map', async () => {
    route = () => [];
    renderWithProviders(<Harness initial={{ address: 'Πουθενά 99' }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Εύρεση στον χάρτη' }));
    });
    expect(await screen.findByText(/Δεν βρέθηκε στον χάρτη/)).toBeInTheDocument();
    expect(latest.latitude).toBe('');
  });

  it('says so when the map service is down', async () => {
    route = () => new Response('', { status: 503 });
    renderWithProviders(<Harness initial={{ address: 'Ερμού 1' }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Εύρεση στον χάρτη' }));
    });
    expect(await screen.findByText(/υπηρεσία χαρτών δεν είναι διαθέσιμη/)).toBeInTheDocument();
  });

  it('cannot search without an address', () => {
    renderWithProviders(<Harness initial={{}} />);
    expect(screen.getByRole('button', { name: 'Εύρεση στον χάρτη' })).toBeDisabled();
  });

  it('fills the coordinates and the address from a click on the map', async () => {
    route = (u) =>
      u.pathname === '/reverse'
        ? {
            lat: u.searchParams.get('lat'),
            lon: u.searchParams.get('lon'),
            address: { road: 'Ερμού', house_number: '5', city: 'Αθήνα', country: 'Ελλάς' },
          }
        : [];
    renderWithProviders(<Harness initial={{}} />);

    const map = screen.getByTestId('location-picker-map').querySelector('.leaflet-container');
    expect(map).not.toBeNull();
    await act(async () => {
      fireEvent.click(map as Element, { clientX: 0, clientY: 0 });
    });

    await waitFor(() => expect(latest.address).toBe('Ερμού 5'));
    expect(latest.city).toBe('Αθήνα');
    expect(latest.country).toBe('Ελλάς');
    expect(Number.isFinite(Number.parseFloat(latest.latitude))).toBe(true);
    expect(Number.isFinite(Number.parseFloat(latest.longitude))).toBe(true);
    expect(screen.getByText('Η διεύθυνση συμπληρώθηκε από τον χάρτη.')).toBeInTheDocument();
  });
});
