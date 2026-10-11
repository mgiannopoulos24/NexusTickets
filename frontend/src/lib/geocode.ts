import { getLocale } from '@/lib/i18n';

/**
 * Address ⇄ coordinates through OpenStreetMap's Nominatim, the geocoder that
 * matches the OSM tiles the maps already use. Its usage policy asks for at most
 * one request a second, so calls are queued and answers cached for the session.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const MIN_INTERVAL_MS = 1100;

export type Coords = { lat: number; lon: number };

/** The parts of an address the forms keep, as found by reverse geocoding. */
export type PlaceParts = {
  address: string;
  city: string;
  country: string;
};

export type ReverseResult = Coords & PlaceParts;

/** Address fields used to look a place up; empty parts are skipped. */
export type AddressQuery = {
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

type NominatimAddress = Partial<
  Record<
    | 'road'
    | 'pedestrian'
    | 'footway'
    | 'house_number'
    | 'city'
    | 'town'
    | 'village'
    | 'municipality'
    | 'suburb'
    | 'country',
    string
  >
>;

type NominatimPlace = {
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

const forwardCache = new Map<string, Promise<Coords | null>>();
const reverseCache = new Map<string, Promise<ReverseResult | null>>();

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

/** Runs requests one after another, at least MIN_INTERVAL_MS apart. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`geocoder answered ${res.status}`);
  return (await res.json()) as T;
}

function language(): string {
  return getLocale() === 'en' ? 'en' : 'el,en';
}

/** Joins the non-empty parts of an address into one search string. */
export function addressQueryText({ address, city, country }: AddressQuery): string {
  return [address, city, country]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(', ');
}

/**
 * Finds the coordinates of an address. Resolves to null when nothing matches;
 * rejects only when the geocoder cannot be reached.
 */
export function geocodeAddress(query: AddressQuery): Promise<Coords | null> {
  const text = addressQueryText(query);
  if (!text) return Promise.resolve(null);

  const key = `${language()}|${text.toLowerCase()}`;
  const cached = forwardCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: text,
    format: 'jsonv2',
    limit: '1',
    'accept-language': language(),
  });
  const pending = throttled(() => getJSON<NominatimPlace[]>(`${NOMINATIM}/search?${params}`)).then(
    (places) => {
      const first = places[0];
      if (!first) return null;
      const coords = { lat: Number(first.lat), lon: Number(first.lon) };
      return isValidCoords(coords) ? coords : null;
    },
  );
  forwardCache.set(key, pending);
  // A failed lookup should be retried next time, not remembered.
  pending.catch(() => forwardCache.delete(key));
  return pending;
}

/** Turns a Nominatim address into the street / city / country the forms use. */
export function placeParts(addr: NominatimAddress | undefined): PlaceParts {
  const street = addr?.road ?? addr?.pedestrian ?? addr?.footway ?? '';
  return {
    address: [street, street ? addr?.house_number : ''].filter(Boolean).join(' '),
    city: addr?.city ?? addr?.town ?? addr?.village ?? addr?.municipality ?? addr?.suburb ?? '',
    country: addr?.country ?? '',
  };
}

/** Finds the address at a point. Resolves to null when the point has none. */
export function reverseGeocode({ lat, lon }: Coords): Promise<ReverseResult | null> {
  // ~1 m precision is plenty, and lets nearby clicks share an answer.
  const key = `${language()}|${lat.toFixed(5)},${lon.toFixed(5)}`;
  const cached = reverseCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': language(),
  });
  const pending = throttled(() =>
    getJSON<NominatimPlace & { error?: string }>(`${NOMINATIM}/reverse?${params}`),
  ).then((place) => (place.error ? null : { lat, lon, ...placeParts(place.address) }));
  reverseCache.set(key, pending);
  pending.catch(() => reverseCache.delete(key));
  return pending;
}

export function isValidCoords(c: Partial<Coords> | null | undefined): c is Coords {
  return (
    c != null &&
    typeof c.lat === 'number' &&
    typeof c.lon === 'number' &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lon) &&
    c.lat >= -90 &&
    c.lat <= 90 &&
    c.lon >= -180 &&
    c.lon <= 180
  );
}

/** Reads a typed coordinate pair ("37,98" or "37.98"); null unless both are valid. */
export function parseCoords(latitude: string, longitude: string): Coords | null {
  const lat = Number.parseFloat(latitude.trim().replace(',', '.'));
  const lon = Number.parseFloat(longitude.trim().replace(',', '.'));
  const coords = { lat, lon };
  return latitude.trim() && longitude.trim() && isValidCoords(coords) ? coords : null;
}

/** Rounds a coordinate for a form field (6 decimals ≈ 0.1 m). */
export function formatCoord(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

/** Clears the caches; for tests. */
export function resetGeocodeCache(): void {
  forwardCache.clear();
  reverseCache.clear();
  queue = Promise.resolve();
  lastCall = 0;
}
