import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

import {
  addressQueryText,
  geocodeAddress,
  isValidCoords,
  type AddressQuery,
  type Coords,
} from '@/lib/geocode';
import { OSM_ATTRIBUTION, OSM_TILES, markerIcon } from '@/lib/osmMap';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

/** MapContainer only reads `center` on mount; this follows later changes. */
export function FollowCenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  const [lat, lon] = center;
  useEffect(() => {
    map.setView([lat, lon], zoom ?? map.getZoom());
  }, [map, lat, lon, zoom]);
  return null;
}

type EventMapEmbedProps = {
  latitude?: number | null;
  longitude?: number | null;
  /**
   * Where the place is in words. Used when there are no coordinates: the map
   * then shows the geocoded address instead of giving up.
   */
  address?: AddressQuery;
  className?: string;
};

type Lookup = { key: string; coords: Coords | null };

function Placeholder({ className, text }: { className?: string; text: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[180px] items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-center text-sm text-neutral-500',
        className,
      )}
    >
      {text}
    </div>
  );
}

export function EventMapEmbed({ latitude, longitude, address, className }: EventMapEmbedProps) {
  const given = { lat: latitude ?? NaN, lon: longitude ?? NaN };
  const hasCoords = isValidCoords(given);
  const query = hasCoords || !address ? '' : addressQueryText(address);

  // The answer is kept with the query it belongs to, so a stale lookup for an
  // earlier address is never shown for the current one.
  const [lookup, setLookup] = useState<Lookup | null>(null);

  useEffect(() => {
    if (!query || !address) return;
    let live = true;
    geocodeAddress(address)
      .catch(() => null)
      .then((coords) => {
        if (live) setLookup({ key: query, coords });
      });
    return () => {
      live = false;
    };
    // `address` is summed up by `query`.
  }, [query]);

  let position: Coords | null = hasCoords ? given : null;
  let approximate = false;
  if (!position && query) {
    if (lookup?.key !== query) {
      return <Placeholder className={className} text={tr('common.mapLocating')} />;
    }
    position = lookup.coords;
    approximate = true;
  }
  if (!position) {
    return <Placeholder className={className} text={tr('common.noMapCoordinates')} />;
  }

  const center: [number, number] = [position.lat, position.lon];
  return (
    <div className="relative h-full">
      <MapContainer
        center={center}
        zoom={approximate ? 14 : 15}
        scrollWheelZoom={false}
        className={cn('z-0 h-full min-h-[220px] w-full rounded-lg', className)}
      >
        <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILES} />
        <FollowCenter center={center} />
        <Marker position={center} icon={markerIcon} />
      </MapContainer>
      {approximate ? (
        <p className="pointer-events-none absolute left-2 top-2 z-[400] rounded-full bg-white/95 px-2.5 py-1 text-[11px] text-neutral-600 shadow comfortaa-regular">
          {tr('common.mapApproximate')}
        </p>
      ) : null}
    </div>
  );
}
