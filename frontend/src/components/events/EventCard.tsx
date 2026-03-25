import { Link } from 'react-router-dom';

import type { Event } from '@/types/models';
import { cn } from '@/lib/utils';

function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';

  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  const monthFmt = new Intl.DateTimeFormat('el-GR', { month: 'short', timeZone: 'UTC' });

  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = monthFmt.format(start).replace('.', '').toLocaleUpperCase('el-GR');
  const endMonth = monthFmt.format(end).replace('.', '').toLocaleUpperCase('el-GR');
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (sameMonth) {
    return `${startDay}–${endDay} ${startMonth} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  }
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

function eventLocation(ev: Pick<Event, 'venue' | 'city'>): string {
  const venue = ev.venue.trim();
  const city = ev.city.trim();
  if (venue && city) return `${venue}, ${city}`;
  return venue || city || '';
}

type EventCardProps = {
  event: Pick<Event, 'id' | 'title' | 'venue' | 'city' | 'start_at' | 'end_at' | 'featured_image_url'>;
  href?: string;
  className?: string;
};

export function EventCard({ event, href, className }: EventCardProps) {
  const dateRange = formatDateRange(event.start_at, event.end_at);
  const location = eventLocation(event);
  const to = href ?? `/events/${event.id}`;

  return (
    <article
      className={cn(
        'group overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition',
        'hover:shadow-md',
        className,
      )}
    >
      <Link to={to} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
          {event.featured_image_url ? (
            <img
              src={event.featured_image_url}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-violet-200 via-violet-400 to-purple-700" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
        </div>

        <div className="p-4">
          {dateRange && (
            <p className="text-[13px] font-semibold tracking-[0.08em] text-[#6d28d9] comfortaa-regular">
              {dateRange}
            </p>
          )}
          <h3 className="mt-2 line-clamp-2 text-lg font-bold tracking-tight text-neutral-950 comfortaa-bold">
            {event.title}
          </h3>
          {location && (
            <p className="mt-4 text-sm uppercase tracking-wide text-neutral-500 comfortaa-regular">
              {location}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}

