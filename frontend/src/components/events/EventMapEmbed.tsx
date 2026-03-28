import L from 'leaflet';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

import { cn } from '@/lib/utils';

const icon = L.icon({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type EventMapEmbedProps = {
  latitude: number;
  longitude: number;
  className?: string;
};

export function EventMapEmbed({ latitude, longitude, className }: EventMapEmbedProps) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return (
      <div
        className={cn(
          'flex min-h-[180px] items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500',
          className,
        )}
      >
        Δεν υπάρχουν συντεταγμένες χάρτη.
      </div>
    );
  }

  const position: [number, number] = [latitude, longitude];

  return (
    <MapContainer
      center={position}
      zoom={15}
      scrollWheelZoom={false}
      className={cn('z-0 h-full min-h-[220px] w-full rounded-lg', className)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position} icon={icon} />
    </MapContainer>
  );
}
