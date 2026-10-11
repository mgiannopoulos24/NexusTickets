import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addressQueryText,
  formatCoord,
  geocodeAddress,
  isValidCoords,
  parseCoords,
  placeParts,
  resetGeocodeCache,
  reverseGeocode,
} from '@/lib/geocode';

let fetchMock: ReturnType<typeof vi.fn>;

function answer(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const requested = (i = 0) => new URL(String(fetchMock.mock.calls[i][0]));

beforeEach(() => {
  resetGeocodeCache();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('addressQueryText', () => {
  it('joins the parts that are filled in', () => {
    expect(addressQueryText({ address: ' Πανεπιστημίου 30 ', city: 'Αθήνα', country: '' })).toBe(
      'Πανεπιστημίου 30, Αθήνα',
    );
    expect(addressQueryText({ address: null, city: undefined, country: '  ' })).toBe('');
  });
});

describe('parseCoords / isValidCoords / formatCoord', () => {
  it('accepts a decimal comma and rejects half pairs and out-of-range values', () => {
    expect(parseCoords('37,9838', '23.7275')).toEqual({ lat: 37.9838, lon: 23.7275 });
    expect(parseCoords('37.9', '')).toBeNull();
    expect(parseCoords('91', '23')).toBeNull();
    expect(parseCoords('37', '181')).toBeNull();
    expect(parseCoords('abc', '23')).toBeNull();
    expect(isValidCoords({ lat: 0, lon: 0 })).toBe(true);
    expect(isValidCoords(null)).toBe(false);
  });

  it('rounds to six decimals', () => {
    expect(formatCoord(37.98381234567)).toBe('37.983812');
    expect(formatCoord(23.5)).toBe('23.5');
  });
});

describe('placeParts', () => {
  it('builds street, city and country from what the geocoder returns', () => {
    expect(
      placeParts({ road: 'Ερμού', house_number: '12', city: 'Αθήνα', country: 'Ελλάς' }),
    ).toEqual({ address: 'Ερμού 12', city: 'Αθήνα', country: 'Ελλάς' });
  });

  it('falls back to towns and villages, and drops a number with no street', () => {
    expect(placeParts({ house_number: '4', village: 'Οία', country: 'Ελλάς' })).toEqual({
      address: '',
      city: 'Οία',
      country: 'Ελλάς',
    });
    expect(placeParts(undefined)).toEqual({ address: '', city: '', country: '' });
  });
});

describe('geocodeAddress', () => {
  it('asks Nominatim for the joined address and returns the first match', async () => {
    answer([{ lat: '37.9758', lon: '23.7348' }]);
    const found = await geocodeAddress({ address: 'Σύνταγμα', city: 'Αθήνα' });

    expect(found).toEqual({ lat: 37.9758, lon: 23.7348 });
    const url = requested();
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(url.searchParams.get('q')).toBe('Σύνταγμα, Αθήνα');
    expect(url.searchParams.get('limit')).toBe('1');
  });

  it('returns null without a request for an empty address', async () => {
    expect(await geocodeAddress({ address: ' ', city: '' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when nothing matches', async () => {
    answer([]);
    expect(await geocodeAddress({ city: 'Ατλαντίδα' })).toBeNull();
  });

  it('remembers an answer for the same address', async () => {
    answer([{ lat: '40.6401', lon: '22.9444' }]);
    await geocodeAddress({ city: 'Θεσσαλονίκη' });
    await geocodeAddress({ city: 'θεσσαλονίκη ' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects when the service fails, and tries again next time', async () => {
    answer({}, 503);
    await expect(geocodeAddress({ city: 'Πάτρα' })).rejects.toThrow();
    answer([{ lat: '38.2466', lon: '21.7346' }]);
    expect(await geocodeAddress({ city: 'Πάτρα' })).toEqual({ lat: 38.2466, lon: 21.7346 });
  });

  it('spaces requests at least a second apart', async () => {
    answer([{ lat: '1', lon: '1' }]);
    answer([{ lat: '2', lon: '2' }]);
    const started = Date.now();
    await Promise.all([geocodeAddress({ city: 'A' }), geocodeAddress({ city: 'B' })]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('reverseGeocode', () => {
  it('returns the address parts at a point', async () => {
    answer({
      lat: '37.97',
      lon: '23.73',
      address: { road: 'Ερμού', house_number: '1', city: 'Αθήνα', country: 'Ελλάς' },
    });
    const place = await reverseGeocode({ lat: 37.97, lon: 23.73 });

    expect(place).toEqual({
      lat: 37.97,
      lon: 23.73,
      address: 'Ερμού 1',
      city: 'Αθήνα',
      country: 'Ελλάς',
    });
    const url = requested();
    expect(url.pathname).toBe('/reverse');
    expect(url.searchParams.get('lat')).toBe('37.97');
    expect(url.searchParams.get('lon')).toBe('23.73');
  });

  it('returns null for a point with no address (open sea)', async () => {
    answer({ error: 'Unable to geocode' });
    expect(await reverseGeocode({ lat: 36, lon: 25 })).toBeNull();
  });
});
