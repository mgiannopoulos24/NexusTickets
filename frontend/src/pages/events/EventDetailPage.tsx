import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Pencil,
  Sofa,
  Ticket,
  Car,
  MessageSquare,
} from 'lucide-react';

import { EventMapEmbed } from '@/components/events/EventMapEmbed';
import { addressQueryText, type AddressQuery } from '@/lib/geocode';
import { PhotoGallery } from '@/components/events/PhotoGallery';
import { BookingForm } from '@/components/bookings/BookingForm';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { eventTypeLabel } from '@/constants/eventTypes';
import { apiErrorMessage } from '@/app/apiEnvelope';
import { useGetEventQuery } from '@/app/eventsApi';
import { useAuth } from '@/hooks/useAuth';
import { useLang } from '@/contexts/langContextCore';
import { INTL_LOCALE, type Locale } from '@/lib/i18n';
import { emptyEventDetail, normalizeEventDetail } from '@/types/eventDetail';

function isUUID(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
}

function formatDateRange(startISO: string, endISO: string, locale: Locale): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  };
  const a = start.toLocaleDateString(INTL_LOCALE[locale], opts);
  const b = end.toLocaleDateString(INTL_LOCALE[locale], opts);
  return `${a} – ${b}`;
}

function formatShort(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(INTL_LOCALE[locale], {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function triLabel(v: boolean | null, yes: string, no: string): string {
  if (v === null) return '—';
  return v ? yes : no;
}

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, locale } = useLang();

  const eventId = id ?? '';
  const validId = !!eventId && isUUID(eventId);

  const {
    data: event,
    isLoading,
    error: queryError,
    refetch,
  } = useGetEventQuery(eventId, { skip: !validId });

  const loading = validId && isLoading;
  const error = !validId
    ? t('eventDetail.invalidId')
    : queryError
      ? apiErrorMessage(queryError, t('eventDetail.loadError'))
      : null;

  const detail = useMemo(
    () => (event ? normalizeEventDetail(event.event_detail) : emptyEventDetail()),
    [event],
  );

  const soldOut = useMemo(() => {
    if (!event?.ticket_types?.length) return false;
    return event.ticket_types.every((t) => t.available <= 0);
  }, [event]);

  // An event that has already finished cannot be booked even if the completion
  // sweeper has not run yet, which mirrors the server-side rule. The clock is
  // read once per mount rather than during every render, so the component stays
  // a pure function of its inputs.
  const [now] = useState(() => Date.now());
  const hasEnded = useMemo(() => {
    if (!event?.end_at) return false;
    const end = new Date(event.end_at);
    return !Number.isNaN(end.getTime()) && end.getTime() < now;
  }, [event, now]);

  const canBook =
    !!user &&
    (user.role === 'attendee' || user.role === 'admin' || user.role === 'organizer') &&
    event?.status === 'published' &&
    !hasEnded;

  // A single explanation for why the booking form is not shown, so a visitor is
  // never left staring at a ticket list with no call to action.
  const bookingBlockedReason = useMemo(() => {
    if (!event) return '';
    if (event.status === 'cancelled') return t('eventDetail.blocked.cancelled');
    if (event.status === 'completed' || hasEnded) return t('eventDetail.blocked.completed');
    if (event.status !== 'published') return t('eventDetail.blocked.unpublished');
    if (event.ticket_types.length === 0) return t('eventDetail.blocked.noTicketTypes');
    if (soldOut) return t('eventDetail.blocked.soldOut');
    if (!user) return t('eventDetail.blocked.login');
    return t('eventDetail.blocked.generic');
  }, [event, hasEnded, soldOut, user, t]);

  // Everything the gallery shows: the featured image first, then the album.
  const galleryImages = useMemo(() => {
    if (!event) return [];
    const urls = [event.featured_image_url, ...event.photos.map((p) => p.url)].filter(
      (u): u is string => Boolean(u),
    );
    return Array.from(new Set(urls));
  }, [event]);

  const locationLine = useMemo(() => {
    if (!event) return '';
    const addr = event.address?.trim();
    const parts = [event.venue.trim(), addr, event.city.trim()].filter(Boolean);
    return parts.join(', ');
  }, [event]);

  // Where the reader may edit this event: the admin form for administrators,
  // the organizer form for its own organizer.
  const editHref = useMemo(() => {
    if (!event || !user) return null;
    if (user.role === 'admin') return `/admin/events/${encodeURIComponent(event.id)}/edit`;
    if (user.id === event.organizer_id)
      return `/organizer/events/${encodeURIComponent(event.id)}/edit`;
    return null;
  }, [event, user]);

  // An administrator may write to the organizer of any event they could still
  // attend, booking or not; everyone else goes through My Bookings (§10).
  const adminMessageHref = useMemo(() => {
    if (!event || user?.role !== 'admin' || user.id === event.organizer_id) return null;
    if (event.status !== 'published' || hasEnded) return null;
    const subject = t('myBookings.messageSubject', { title: event.title });
    return `/messages?compose=1&to=${encodeURIComponent(event.organizer_id)}&event=${encodeURIComponent(event.id)}&subject=${encodeURIComponent(subject)}`;
  }, [event, user, hasEnded, t]);

  // Where the event is in words: the street address when there is one, else
  // the venue's name. The map falls back to it when there are no coordinates.
  const placeQuery = useMemo<AddressQuery | null>(
    () =>
      event
        ? {
            address: event.address?.trim() || event.venue,
            city: event.city,
            country: event.country,
          }
        : null,
    [event],
  );

  const mapsHref = useMemo(() => {
    if (event?.latitude != null && event?.longitude != null) {
      return `https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=16/${event.latitude}/${event.longitude}`;
    }
    const text = placeQuery ? addressQueryText(placeQuery) : '';
    return text ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(text)}` : null;
  }, [event, placeQuery]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6">
        <SkeletonList rows={6} />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6">
        <ErrorMessage
          message={error ?? t('eventDetail.notFound')}
          onRetry={validId ? () => void refetch() : undefined}
        />
        <Link
          to="/events"
          className="comfortaa-regular mt-4 inline-block text-sm text-[var(--nexus-purple)] hover:underline"
        >
          {t('eventDetail.backToEvents')}
        </Link>
      </div>
    );
  }

  const useful = detail.useful;
  const org = detail.organizer_display;

  const occurrences =
    detail.occurrences.length > 0
      ? detail.occurrences
      : [{ starts_at: event.start_at, ends_at: event.end_at, label: undefined }];

  return (
    <div className="min-h-screen bg-white">
      {event.status === 'cancelled' && (
        <div
          role="status"
          className="border-b border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-900 comfortaa-regular"
        >
          {t('eventDetail.cancelledBanner')}
        </div>
      )}
      {(event.status === 'completed' || (event.status === 'published' && hasEnded)) && (
        <div
          role="status"
          className="border-b border-neutral-200 bg-neutral-100 px-4 py-3 text-center text-sm text-neutral-700 comfortaa-regular"
        >
          {t('eventDetail.completedBanner')}
        </div>
      )}
      {event.status === 'draft' && (
        <div
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 comfortaa-regular"
        >
          {t('eventDetail.draftBanner')}
        </div>
      )}

      <div className="border-b border-neutral-200 bg-neutral-50/80">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {event.event_type && (
                <span className="rounded-full bg-[var(--nexus-purple)]/10 px-3 py-1 text-xs font-medium text-[var(--nexus-purple)] comfortaa-regular">
                  {eventTypeLabel(event.event_type)}
                </span>
              )}
              {event.categories.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-neutral-200/70 px-3 py-1 text-xs text-neutral-700 comfortaa-regular"
                >
                  {c}
                </span>
              ))}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl comfortaa-bold">
              {event.title}
            </h1>
            <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-700 comfortaa-regular">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--nexus-purple)]" aria-hidden />
                <span>{locationLine}</span>
              </p>
              <p className="flex items-start gap-2">
                <Calendar
                  className="mt-0.5 size-4 shrink-0 text-[var(--nexus-purple)]"
                  aria-hidden
                />
                <span>{formatDateRange(event.start_at, event.end_at, locale)}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            {editHref ? (
              <Button
                asChild
                variant="outline"
                className="comfortaa-regular border-neutral-300 text-neutral-800"
              >
                <Link
                  to={editHref}
                  aria-label={t('eventDetail.edit')}
                  title={t('eventDetail.edit')}
                >
                  <Pencil className="mr-2 size-4" />
                  {t('eventDetail.edit')}
                </Link>
              </Button>
            ) : null}
            {adminMessageHref ? (
              <Button
                asChild
                variant="outline"
                className="comfortaa-regular border-neutral-300 text-neutral-800"
              >
                <Link to={adminMessageHref}>
                  <MessageSquare className="mr-2 size-4" aria-hidden />
                  {t('myBookings.messageOrganizer')}
                </Link>
              </Button>
            ) : null}
            {canBook && !soldOut ? (
              <Button
                asChild
                className="bg-nexus-coral px-6 text-white hover:bg-nexus-coral-dark comfortaa-regular"
              >
                <a href="#tickets">
                  <Ticket className="mr-2 size-4" />
                  {t('eventDetail.ticketsButton')}
                </a>
              </Button>
            ) : soldOut ? (
              <span className="rounded-full border-2 border-[var(--nexus-red)] px-4 py-2 text-sm font-semibold text-[var(--nexus-red)] comfortaa-regular">
                {t('eventDetail.soldOut')}
              </span>
            ) : (
              <Button
                asChild
                variant="outline"
                className="border-[var(--nexus-purple)] text-[var(--nexus-purple)]"
              >
                <Link to="/login">{t('eventDetail.loginToBook')}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
        {/* Photos and tickets first (the things a visitor came for), the
            descriptive tabs underneath. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-labelledby="photos-heading">
            <h2 id="photos-heading" className="sr-only">
              {t('eventDetail.photos')}
            </h2>
            <PhotoGallery images={galleryImages} title={event.title} />
          </section>

          <section
            id="tickets"
            aria-labelledby="tickets-heading"
            className="scroll-mt-24 self-start rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="tickets-heading"
                className="text-lg font-semibold text-neutral-950 comfortaa-bold"
              >
                {t('eventDetail.tickets')}
              </h2>
              <p className="text-xs text-neutral-600 comfortaa-regular">
                {t('eventDetail.capacityLine', {
                  capacity: event.capacity,
                  sold: event.tickets_sold,
                  remaining: event.tickets_remaining,
                })}
              </p>
            </div>
            {canBook && !soldOut && event.ticket_types.length > 0 ? (
              <div className="mt-4">
                <BookingForm event={event} />
              </div>
            ) : (
              <>
                {event.ticket_types.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {event.ticket_types.map((tt) => (
                      <li
                        key={tt.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-neutral-900 comfortaa-regular">
                            {tt.name}
                          </p>
                          <p className="text-xs text-neutral-500 comfortaa-regular">
                            {t('eventDetail.availableOf', {
                              available: tt.available,
                              quantity: tt.quantity,
                            })}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-[var(--nexus-purple)] comfortaa-bold">
                          {tt.price.toFixed(2)} €
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-4 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 comfortaa-regular">
                  {bookingBlockedReason}
                </p>
              </>
            )}
          </section>
        </div>

        <Tabs defaultValue="description" className="mt-10 w-full">
          <TabsList
            variant="line"
            className="mb-6 w-full flex-wrap justify-start gap-2 border-b border-neutral-200 pb-0"
          >
            <TabsTrigger value="description" className="comfortaa-regular">
              {t('eventDetail.tabs.description')}
            </TabsTrigger>
            <TabsTrigger value="useful" className="comfortaa-regular">
              {t('eventDetail.tabs.useful')}
            </TabsTrigger>
            <TabsTrigger value="organizer" className="comfortaa-regular">
              {t('eventDetail.tabs.organizer')}
            </TabsTrigger>
            <TabsTrigger value="dates" className="comfortaa-regular">
              {t('eventDetail.tabs.dates')}
            </TabsTrigger>
            <TabsTrigger value="artists" className="comfortaa-regular">
              {t('eventDetail.tabs.artists')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-0">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="prose prose-neutral max-w-none">
                <div className="whitespace-pre-wrap text-neutral-800 comfortaa-regular">
                  {event.description}
                </div>
              </div>
              {detail.contributors.length > 0 && (
                <aside className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
                  <h2 className="text-sm font-semibold text-neutral-900 comfortaa-bold">
                    {t('eventDetail.contributors')}
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {detail.contributors.map((c, i) => (
                      <li
                        key={`${c.role}-${i}`}
                        className="flex flex-col border-b border-neutral-200/80 pb-2 last:border-0"
                      >
                        <span className="text-xs text-neutral-500 comfortaa-regular">{c.role}</span>
                        <span className="font-medium text-neutral-900 comfortaa-regular">
                          {c.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </div>
          </TabsContent>

          <TabsContent value="useful" className="mt-0 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCard
                icon={<Clock className="size-5 text-[var(--nexus-purple)]" />}
                title={t('eventDetail.duration')}
                value={
                  useful?.duration_minutes != null
                    ? t('eventDetail.minutes', { n: useful.duration_minutes })
                    : '—'
                }
              />
              <InfoCard
                icon={<Clock className="size-5 text-[var(--nexus-purple)]" />}
                title={t('eventDetail.intermission')}
                value={
                  useful?.intermission_minutes != null
                    ? t('eventDetail.minutes', { n: useful.intermission_minutes })
                    : '—'
                }
              />
              <InfoCard
                icon={<Sofa className="size-5 text-[var(--nexus-purple)]" />}
                title={t('eventDetail.seated')}
                value={triLabel(
                  useful?.seated_only ?? null,
                  t('eventDetail.yes'),
                  t('eventDetail.no'),
                )}
              />
              <InfoCard
                icon={<Car className="size-5 text-[var(--nexus-purple)]" />}
                title={t('eventDetail.parking')}
                value={triLabel(
                  useful?.parking_available ?? null,
                  t('eventDetail.yes'),
                  t('eventDetail.no'),
                )}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 comfortaa-bold">
                  <Ticket className="size-4" />
                  {t('eventDetail.policy')}
                </h3>
                {useful?.cancellation_policy ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700 comfortaa-regular">
                    {useful.cancellation_policy}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-neutral-500 comfortaa-regular">
                    {t('eventDetail.noPolicy')}
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-neutral-200 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 comfortaa-bold">
                  <MapPin className="size-4" />
                  {t('eventDetail.location')}
                </h3>
                <p className="mt-2 text-sm font-medium text-neutral-800 comfortaa-regular">
                  {event.venue}
                </p>
                {(event.latitude != null && event.longitude != null) || mapsHref ? (
                  <div className="relative mt-3 overflow-hidden rounded-lg">
                    <EventMapEmbed
                      latitude={event.latitude}
                      longitude={event.longitude}
                      address={placeQuery ?? undefined}
                    />
                    {mapsHref && (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-[var(--nexus-purple)] shadow comfortaa-regular"
                      >
                        {t('eventDetail.openInMaps')}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500 comfortaa-regular">
                    {t('eventDetail.noCoordinates')}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="organizer" className="mt-0">
            <div className="rounded-2xl border border-neutral-200 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-950 comfortaa-bold">
                <Building2 className="size-5 text-[var(--nexus-purple)]" />
                {t('eventDetail.organizer')}
              </h2>
              {org && (org.legal_name || org.headquarters) ? (
                <>
                  <p className="mt-3 text-lg font-bold uppercase tracking-wide text-neutral-900 comfortaa-bold">
                    {org.legal_name}
                  </p>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-neutral-500 comfortaa-regular">
                        {t('eventDetail.headquarters')}
                      </dt>
                      <dd className="text-neutral-900 comfortaa-regular">
                        {org.headquarters || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500 comfortaa-regular">
                        {t('eventDetail.vat')}
                      </dt>
                      <dd className="text-neutral-900 comfortaa-regular">
                        {org.vat_number || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500 comfortaa-regular">
                        {t('eventDetail.email')}
                      </dt>
                      <dd>
                        {org.email ? (
                          <a
                            href={`mailto:${org.email}`}
                            className="text-[var(--nexus-purple)] hover:underline"
                          >
                            {org.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500 comfortaa-regular">
                        {t('eventDetail.phone')}
                      </dt>
                      <dd>
                        {org.phone ? (
                          <a
                            href={`tel:${org.phone}`}
                            className="text-[var(--nexus-purple)] hover:underline"
                          >
                            {org.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-neutral-500 comfortaa-regular">
                        {t('eventDetail.taxOffice')}
                      </dt>
                      <dd className="text-neutral-900 comfortaa-regular">
                        {org.tax_office || '—'}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-3 text-sm text-neutral-600 comfortaa-regular">
                  {t('eventDetail.noOrganizerInfo')}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="dates" className="mt-0">
            <ul className="space-y-3 border-l-2 border-[var(--nexus-red)] pl-4">
              {occurrences.map((oc, i) => (
                <li
                  key={`${oc.starts_at}-${i}`}
                  className="flex flex-col gap-2 border-b border-neutral-100 pb-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 comfortaa-bold">
                      {formatShort(oc.starts_at, locale)}
                    </p>
                    {oc.label && (
                      <p className="text-xs text-neutral-500 comfortaa-regular">{oc.label}</p>
                    )}
                  </div>
                  <div className="text-sm text-neutral-700 comfortaa-regular">
                    <span className="font-medium">{event.title}</span>
                    {event.address && (
                      <span className="mt-1 block text-xs underline text-[var(--nexus-purple)]">
                        {event.address}
                      </span>
                    )}
                    <span className="mt-1 block text-xs">
                      {event.venue} – {event.city}
                    </span>
                  </div>
                  <div>
                    {soldOut ? (
                      <span className="inline-flex rounded-full border border-[var(--nexus-red)] px-3 py-1 text-xs font-semibold text-[var(--nexus-red)]">
                        {t('eventDetail.soldOut')}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-700 comfortaa-regular">
                        {t('eventDetail.availableTickets')}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="artists" className="mt-0">
            {detail.artists.length === 0 ? (
              <p className="text-sm text-neutral-600 comfortaa-regular">
                {t('eventDetail.noArtists')}
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {detail.artists.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="rounded-xl border border-neutral-200 p-4">
                    <p className="font-semibold text-neutral-900 comfortaa-bold">{a.name}</p>
                    {a.role && (
                      <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">{a.role}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-10 text-center">
          <Link
            to="/events"
            className="text-sm text-[var(--nexus-purple)] hover:underline comfortaa-regular"
          >
            {t('eventDetail.allEvents')}
          </Link>
        </p>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-neutral-700">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 comfortaa-regular">
          {title}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-950 comfortaa-bold">{value}</p>
    </div>
  );
}
