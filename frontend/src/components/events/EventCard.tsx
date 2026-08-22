import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Event } from '@/types/models';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Ticket } from 'lucide-react';
import { formatShortDate } from '@/helpers/formatDate';
import { formatCurrency } from '@/helpers/formatCurrency';
import { useLang } from '@/contexts/langContext';

interface EventCardProps {
  event: Event;
  className?: string;
}

const EventCard: React.FC<EventCardProps> = memo(({ event, className }) => {
  const { t } = useLang();
  const minPrice = Math.min(...event.ticket_types.map((t) => t.price));
  const totalAvailable = event.ticket_types.reduce((acc, t) => acc + t.available, 0);

  return (
    <Card
      className={cn(
        'h-full flex flex-col overflow-hidden transition-all hover:shadow-md group',
        className,
      )}
    >
      <CardHeader className="p-0">
        <Link to={`/events/${event.id}`} className="block relative aspect-[4/3] overflow-hidden">
          {event.featured_image_url ? (
            <img
              src={event.featured_image_url}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-200 via-violet-400 to-purple-700" />
          )}
          <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end">
            {event.categories.slice(0, 2).map((cat) => (
              <Badge
                key={cat}
                variant="secondary"
                className="bg-white/90 backdrop-blur text-[10px]"
              >
                {cat}
              </Badge>
            ))}
            {event.categories.length > 2 && (
              <Badge variant="secondary" className="bg-white/90 backdrop-blur text-[10px]">
                +{event.categories.length - 2}
              </Badge>
            )}
          </div>
        </Link>
      </CardHeader>

      <CardContent className="p-4 flex-1">
        <Link to={`/events/${event.id}`} className="block mb-2">
          <h3 className="font-bold text-lg leading-tight hover:text-primary transition-colors line-clamp-2 comfortaa-bold">
            {event.title}
          </h3>
        </Link>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-600" />
            <span className="comfortaa-regular">{formatShortDate(event.start_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-violet-600" />
            <span className="truncate comfortaa-regular">
              {event.venue}, {event.city}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex items-center justify-between mt-auto">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground tracking-wider font-semibold">
            {t('labels.price')}
          </span>
          <span className="font-bold text-primary comfortaa-bold">{formatCurrency(minPrice)}</span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground tracking-wider font-semibold">
            {t('labels.available')}
          </span>
          <div className="flex items-center gap-1 font-medium">
            <Ticket className="w-3 h-3 text-muted-foreground" />
            <span className="comfortaa-regular">{totalAvailable}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
});

EventCard.displayName = 'EventCard';

export default EventCard;
