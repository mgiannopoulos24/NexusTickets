import { useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent, Marker as LeafletMarker } from 'leaflet';

import 'leaflet/dist/leaflet.css';

import { FollowCenter } from '@/components/events/EventMapEmbed';
import { Button } from '@/components/ui/button';
import { useLang } from '@/contexts/langContextCore';
import {
  addressQueryText,
  formatCoord,
  geocodeAddress,
  parseCoords,
  reverseGeocode,
  type Coords,
} from '@/lib/geocode';
import { OSM_ATTRIBUTION, OSM_TILES, markerIcon } from '@/lib/osmMap';
import { cn } from '@/lib/utils';

/** The location fields a form keeps; coordinates as typed text. */
export type LocationValue = {
  address: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
};

type LocationPickerProps = {
  value: LocationValue;
  onChange: (patch: Partial<LocationValue>) => void;
  disabled?: boolean;
  className?: string;
};

/** Greece, where nearly every event is: the view before anything is chosen. */
const DEFAULT_CENTER: [number, number] = [38.5, 23.8];
const DEFAULT_ZOOM = 6;
/** Pause in typing before the address is looked up on its own. */
const AUTO_LOCATE_MS = 900;

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'notFound' }
  | { kind: 'failed' }
  | { kind: 'filled' };

function ClickToPlace({ onPick, disabled }: { onPick: (c: Coords) => void; disabled?: boolean }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      if (!disabled) onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

/**
 * Edits a location from either side. Typing an address places the pin by
 * itself, as long as the coordinates have not been set by hand; "Find on map"
 * does it on demand. Clicking the map, or dragging the pin, sets the
 * coordinates and fills in the address found there.
 *
 * Coordinates stay optional: a place given only by its address is still shown
 * on the event page, geocoded there.
 */
export function LocationPicker({ value, onChange, disabled, className }: LocationPickerProps) {
  const { t } = useLang();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const coords = parseCoords(value.latitude, value.longitude);
  const query = addressQueryText(value);

  // Coordinates this picker derived from the address. While the form still
  // holds them they follow the address; once the user types or picks their
  // own, they are left alone.
  const [autoCoords, setAutoCoords] = useState<string | null>(null);
  const followsAddress = !coords || autoCoords === `${value.latitude}|${value.longitude}`;

  // The latest props, for callbacks that outlive the render they came from.
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });

  const writeCoords = (c: Coords, auto: boolean) => {
    const latitude = formatCoord(c.lat);
    const longitude = formatCoord(c.lon);
    setAutoCoords(auto ? `${latitude}|${longitude}` : null);
    latest.current.onChange({ latitude, longitude });
  };

  const locate = async (auto: boolean) => {
    const current = latest.current.value;
    if (!addressQueryText(current)) return;
    setStatus({ kind: 'busy' });
    try {
      const found = await geocodeAddress(current);
      if (!found) {
        setStatus({ kind: 'notFound' });
        return;
      }
      writeCoords(found, auto);
      setStatus({ kind: 'idle' });
    } catch {
      setStatus({ kind: 'failed' });
    }
  };

  useEffect(() => {
    if (disabled || !query || !followsAddress) return;
    const timer = window.setTimeout(() => void locate(true), AUTO_LOCATE_MS);
    return () => window.clearTimeout(timer);
    // Re-run on a new address only; locate reads the rest from `latest`.
  }, [query, disabled]);

  const pick = async (c: Coords) => {
    writeCoords(c, false);
    setStatus({ kind: 'busy' });
    try {
      const place = await reverseGeocode(c);
      if (!place) {
        setStatus({ kind: 'notFound' });
        return;
      }
      // Fill what was found; keep what the user typed where the map has nothing.
      const patch: Partial<LocationValue> = {};
      if (place.address) patch.address = place.address;
      if (place.city) patch.city = place.city;
      if (place.country) patch.country = place.country;
      latest.current.onChange(patch);
      setStatus({ kind: 'filled' });
    } catch {
      setStatus({ kind: 'failed' });
    }
  };

  const center: [number, number] = coords ? [coords.lat, coords.lon] : DEFAULT_CENTER;

  const message = (() => {
    switch (status.kind) {
      case 'busy':
        return t('locationPicker.searching');
      case 'notFound':
        return t('locationPicker.notFound');
      case 'failed':
        return t('locationPicker.failed');
      case 'filled':
        return t('locationPicker.filled');
      default:
        return coords ? t('locationPicker.adjust') : t('locationPicker.hint');
    }
  })();

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !query || status.kind === 'busy'}
          onClick={() => void locate(false)}
          className="comfortaa-regular"
        >
          {status.kind === 'busy' ? (
            <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
          ) : (
            <LocateFixed className="mr-1 size-4" aria-hidden />
          )}
          {t('locationPicker.find')}
        </Button>
        <p
          className={cn(
            'comfortaa-regular text-xs',
            status.kind === 'notFound' || status.kind === 'failed'
              ? 'text-[var(--nexus-red)]'
              : 'text-neutral-500',
          )}
          role="status"
        >
          {message}
        </p>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-lg border border-neutral-200',
          !disabled && 'cursor-crosshair',
        )}
        data-testid="location-picker-map"
      >
        <MapContainer
          center={center}
          zoom={coords ? 15 : DEFAULT_ZOOM}
          scrollWheelZoom={false}
          className="z-0 h-[260px] w-full"
        >
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILES} />
          <FollowCenter center={center} zoom={coords ? 15 : DEFAULT_ZOOM} />
          <ClickToPlace onPick={(c) => void pick(c)} disabled={disabled} />
          {coords ? (
            <Marker
              position={center}
              icon={markerIcon}
              draggable={!disabled}
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as LeafletMarker).getLatLng();
                  void pick({ lat, lon: lng });
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}
