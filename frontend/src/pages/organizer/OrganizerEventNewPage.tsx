import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';

import { EventDetailTemplateForm } from '@/components/admin/EventDetailTemplateForm';
import { EventMapEmbed } from '@/components/events/EventMapEmbed';
import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import { apiErrorMessage } from '@/app/apiEnvelope';
import {
  useCreateEventMutation,
  useListCategoriesQuery,
  useUploadFeaturedImageMutation,
  type EventWritePayload,
} from '@/app/eventsApi';
import { DEFAULT_EVENT_TYPE, eventTypeOptions } from '@/constants/eventTypes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { EventDetail } from '@/types/eventDetail';
import { emptyEventDetail } from '@/types/eventDetail';
import { useLang } from '@/contexts/langContextCore';
import { tr } from '@/lib/i18n';

type TicketDraft = {
  clientId: string;
  name: string;
  price: string;
  quantity: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseTimeHHMM(raw: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function toUtcRfc3339(date: Date, timeHHMM: string): string | null {
  const parsed = parseTimeHHMM(timeHHMM);
  if (!parsed) return null;
  const utc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    parsed.hour,
    parsed.minute,
    0,
    0,
  );
  return new Date(utc).toISOString();
}

function formatDateForUi(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('el-GR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function defaultTomorrowUtcMidnight(): Date {
  const d = new Date();
  const next = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return next;
}

function defaultEndUtcMidnight(start: Date): Date {
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1, 0, 0, 0, 0),
  );
}

function NewEventTimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [clockOpen, setClockOpen] = useState(true);

  // A disabled picker is always closed; derived rather than pushed into state
  // by an effect.
  const isOpen = clockOpen && !disabled;

  const parsed = parseTimeHHMM(value);
  const pickerValue = parsed ? `${pad2(parsed.hour)}:${pad2(parsed.minute)}:00` : null;

  return (
    <div
      className={cn(
        'w-full',
        '[&_.react-time-picker]:!flex [&_.react-time-picker]:w-full [&_.react-time-picker]:max-w-none [&_.react-time-picker]:flex-col [&_.react-time-picker]:items-stretch',
        '[&_.react-time-picker__wrapper]:w-full [&_.react-time-picker__inputGroup]:w-full',
        '[&_.react-time-picker__clock]:!z-[60] [&_.react-time-picker__clock]:mx-auto',
      )}
    >
      <TimePicker
        className="w-full max-w-none"
        isOpen={isOpen}
        onClockOpen={() => setClockOpen(true)}
        onClockClose={() => setClockOpen(false)}
        value={pickerValue}
        onChange={(v) => {
          if (v == null) return;
          const m = /^(\d{1,2}):(\d{2})/.exec(String(v).trim());
          if (!m) return;
          const hour = Number(m[1]);
          const minute = Number(m[2]);
          if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
          if (hour < 0 || hour > 23) return;
          if (minute < 0 || minute > 59) return;
          onChange(`${pad2(hour)}:${pad2(minute)}`);
        }}
        format="HH:mm"
        locale="el-GR"
        maxDetail="minute"
        clockAriaLabel={tr('eventForm.clock')}
        clearAriaLabel={tr('eventForm.clearTime')}
        disabled={disabled}
        clockProps={{
          size: 200,
          renderSecondHand: false,
        }}
      />
    </div>
  );
}

function DateTimeDialogField({
  label,
  date,
  timeHHMM,
  onChange,
}: {
  label: string;
  date: Date | undefined;
  timeHHMM: string;
  onChange: (nextDate: Date | undefined, nextTime: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date | undefined>(date);
  const [tempTime, setTempTime] = useState(timeHHMM);

  const uiDate = formatDateForUi(date);
  const uiValue = uiDate ? `${uiDate} ${timeHHMM}` : '';

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setTempDate(date);
      setTempTime(timeHHMM);
      setStep('date');
    }
  };

  const handleDateSelect = (d: Date | undefined) => {
    setTempDate(d);
    if (d) {
      setStep('time');
    }
  };

  const handleConfirm = () => {
    onChange(tempDate, tempTime);
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">{label}</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 cursor-pointer px-0 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 comfortaa-regular"
          onClick={() => handleOpen(true)}
          aria-label={tr('eventForm.editField', { label })}
        >
          <PencilIcon className="size-4" />
        </Button>
      </div>

      <div className="border border-neutral-200 bg-white px-3 py-2">
        <p className="text-sm text-neutral-900 comfortaa-regular">{uiValue || '—'}</p>
      </div>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent
          className={cn('sm:max-w-md', step === 'time' && 'overflow-visible sm:max-w-lg')}
        >
          <DialogHeader>
            <DialogTitle className="comfortaa-bold">{label}</DialogTitle>
            <DialogDescription className="comfortaa-regular">
              {step === 'date' ? tr('eventForm.pickDate') : tr('eventForm.pickTime')}
            </DialogDescription>
          </DialogHeader>

          {step === 'date' ? (
            <div className="flex flex-col gap-4">
              <Calendar
                mode="single"
                selected={tempDate}
                onSelect={handleDateSelect}
                variant="calendar-alt"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('time')}
                  disabled={!tempDate}
                  className="comfortaa-regular"
                >
                  {tr('eventForm.next')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <NewEventTimePicker value={tempTime} onChange={setTempTime} disabled={!tempDate} />
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('date')}
                  className="comfortaa-regular"
                >
                  {tr('eventForm.back')}
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  className="bg-[var(--nexus-purple)] text-white hover:bg-[var(--nexus-purple-dark)] comfortaa-regular"
                >
                  {tr('eventForm.confirm')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OrganizerEventNewPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [createEvent] = useCreateEventMutation();
  const [uploadFeaturedImage] = useUploadFeaturedImageMutation();

  const { data: categories, isLoading: loadingCats } = useListCategoriesQuery();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [capacity, setCapacity] = useState('100');
  const [eventType, setEventType] = useState<string>(DEFAULT_EVENT_TYPE);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [ticketRows, setTicketRows] = useState<TicketDraft[]>([
    { clientId: '1', name: tr('eventForm.defaultTicketName'), price: '0', quantity: '100' },
  ]);
  const [detail, setDetail] = useState<EventDetail>(emptyEventDetail());

  const featuredObjectUrlRef = useRef<string | null>(null);
  const [featuredPreview, setFeaturedPreview] = useState<string | null>(null);
  const [pendingFeaturedFile, setPendingFeaturedFile] = useState<File | null>(null);

  const [startDate, setStartDate] = useState<Date | undefined>(() => defaultTomorrowUtcMidnight());
  const [endDate, setEndDate] = useState<Date | undefined>(() =>
    defaultEndUtcMidnight(defaultTomorrowUtcMidnight()),
  );
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('22:00');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (featuredObjectUrlRef.current) {
        URL.revokeObjectURL(featuredObjectUrlRef.current);
        featuredObjectUrlRef.current = null;
      }
    };
  }, []);

  const syncStart = (nextDate: Date | undefined, nextTime: string) => {
    setStartDate(nextDate);
    setStartTime(nextTime);
  };

  const syncEnd = (nextDate: Date | undefined, nextTime: string) => {
    setEndDate(nextDate);
    setEndTime(nextTime);
  };

  const mapPreviewCoords = useMemo(() => {
    const latRaw = latitude.trim().replace(',', '.');
    const lonRaw = longitude.trim().replace(',', '.');
    if (latRaw === '' || lonRaw === '') return null;
    const lat = Number.parseFloat(latRaw);
    const lon = Number.parseFloat(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  }, [latitude, longitude]);

  const categoryNames = useMemo(() => (categories ?? []).map((c) => c.name), [categories]);

  const toggleCategory = (name: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const onFeaturedFileChange = (file: File | undefined) => {
    if (featuredObjectUrlRef.current) {
      URL.revokeObjectURL(featuredObjectUrlRef.current);
      featuredObjectUrlRef.current = null;
    }
    if (!file) {
      setPendingFeaturedFile(null);
      setFeaturedPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    featuredObjectUrlRef.current = objectUrl;
    setFeaturedPreview(objectUrl);
    setPendingFeaturedFile(file);
  };

  const addTicketRow = () => {
    setTicketRows((rows) => [
      ...rows,
      {
        clientId: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        name: '',
        price: '0',
        quantity: '0',
      },
    ]);
  };

  const removeTicketRow = (clientId: string) => {
    setTicketRows((rows) =>
      rows.length <= 1 ? rows : rows.filter((r) => r.clientId !== clientId),
    );
  };

  const updateTicketRow = (
    clientId: string,
    patch: Partial<Pick<TicketDraft, 'name' | 'price' | 'quantity'>>,
  ) => {
    setTicketRows((rows) => rows.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)));
  };

  const onSubmit = async () => {
    setError(null);
    if (!startDate || !endDate) {
      setError(t('eventForm.v.dates'));
      return;
    }
    const startAt = toUtcRfc3339(startDate, startTime);
    const endAt = toUtcRfc3339(endDate, endTime);
    if (!startAt || !endAt) {
      setError(t('eventForm.v.time'));
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError(t('eventForm.v.endAfterStart'));
      return;
    }

    const cap = Number.parseInt(capacity.trim(), 10);
    if (!Number.isFinite(cap) || cap < 0) {
      setError(t('eventForm.v.capacity'));
      return;
    }

    const parsedTickets = ticketRows.map((r) => ({
      name: r.name.trim(),
      price: Number.parseFloat(r.price.replace(',', '.')),
      quantity: Number.parseInt(r.quantity.trim(), 10),
    }));

    for (const ticket of parsedTickets) {
      if (
        ticket.name === '' ||
        !Number.isFinite(ticket.price) ||
        ticket.price < 0 ||
        !Number.isFinite(ticket.quantity) ||
        ticket.quantity < 0
      ) {
        setError(t('eventForm.v.ticketTypes'));
        return;
      }
    }

    if (selectedCategories.size === 0) {
      setError(t('eventForm.v.category'));
      return;
    }
    if (parsedTickets.length === 0) {
      setError(t('eventForm.v.oneTicketType'));
      return;
    }

    const sumQty = parsedTickets.reduce((acc, t) => acc + t.quantity, 0);
    if (sumQty > cap) {
      setError(t('eventForm.v.seatsOverCapacity'));
      return;
    }

    const latRaw = latitude.trim().replace(',', '.');
    const lonRaw = longitude.trim().replace(',', '.');
    const latNum = latRaw === '' ? Number.NaN : Number.parseFloat(latRaw);
    const lonNum = lonRaw === '' ? Number.NaN : Number.parseFloat(lonRaw);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      venue: venue.trim(),
      city: city.trim(),
      country: country.trim() || null,
      address: address.trim() || null,
      start_at: startAt,
      end_at: endAt,
      capacity: cap,
      event_type: eventType,
      categories: Array.from(selectedCategories),
      ticket_types: parsedTickets,
      event_detail: detail,
    };
    if (latRaw !== '' && Number.isFinite(latNum)) payload.latitude = latNum;
    if (lonRaw !== '' && Number.isFinite(lonNum)) payload.longitude = lonNum;

    setSubmitting(true);
    try {
      const created = await createEvent(payload as EventWritePayload).unwrap();
      const id = created.id;

      if (pendingFeaturedFile) {
        try {
          await uploadFeaturedImage({ id, file: pendingFeaturedFile }).unwrap();
        } catch {
          // The event exists; only the image failed, so say so and carry on to
          // the edit screen where it can be retried.
          toast.error(t('eventForm.createdImageFailed'));
        }
      }

      void navigate(`/organizer/events/${encodeURIComponent(id)}/edit`);
    } catch (e: unknown) {
      setError(apiErrorMessage(e, t('eventForm.createFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OrganizerLayout>
      <div className="bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 comfortaa-regular">
              <Link to="/organizer/events" className="hover:underline">
                {t('eventForm.myEvents')}
              </Link>{' '}
              / {t('eventForm.newEvent')}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950 comfortaa-bold">
              {t('eventForm.newEvent')}
            </h1>
          </div>
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting || loadingCats}
            className="rounded-none border-2 border-[var(--nexus-purple)] bg-transparent px-4 py-1.5 text-sm text-[var(--nexus-purple)] hover:bg-[var(--nexus-purple)] hover:text-white comfortaa-regular"
          >
            {submitting ? t('eventForm.creating') : t('eventForm.create')}
          </Button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">
            {error}
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800 comfortaa-regular">
                {t('eventForm.title')}
              </label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800 comfortaa-regular">
                {t('eventForm.description')}
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-32"
              />
            </div>
            {mapPreviewCoords && (
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <p className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-800 comfortaa-bold">
                  {t('eventForm.map')}
                </p>
                <div className="p-2">
                  <EventMapEmbed
                    latitude={mapPreviewCoords.lat}
                    longitude={mapPreviewCoords.lon}
                    className="min-h-[280px] rounded-lg"
                  />
                </div>
              </div>
            )}
            <EventDetailTemplateForm value={detail} onChange={setDetail} disabled={submitting} />

            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">
                {t('eventForm.ticketTypes')}
              </p>
              <p className="mt-1 text-xs text-neutral-500 comfortaa-regular">
                {t('eventForm.ticketTypesHint')}
              </p>
              <div className="mt-4 space-y-3">
                {ticketRows.map((row) => (
                  <div
                    key={row.clientId}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-100 p-3 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto]"
                  >
                    <Input
                      placeholder={t('eventForm.typeName')}
                      value={row.name}
                      onChange={(e) => updateTicketRow(row.clientId, { name: e.target.value })}
                    />
                    <Input
                      placeholder={t('eventForm.price')}
                      inputMode="decimal"
                      value={row.price}
                      onChange={(e) => updateTicketRow(row.clientId, { price: e.target.value })}
                    />
                    <Input
                      placeholder={t('eventForm.seats')}
                      inputMode="numeric"
                      value={row.quantity}
                      onChange={(e) => updateTicketRow(row.clientId, { quantity: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="justify-self-end text-neutral-500 hover:text-[var(--nexus-red)]"
                      aria-label={t('eventForm.removeType')}
                      disabled={ticketRows.length <= 1}
                      onClick={() => removeTicketRow(row.clientId)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="comfortaa-regular"
                  onClick={addTicketRow}
                >
                  <PlusIcon className="mr-1 size-4" />
                  {t('eventForm.addType')}
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">
                {t('eventForm.details')}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="event-type"
                    className="mb-1 block text-xs text-neutral-600 comfortaa-regular"
                  >
                    {t('eventForm.eventType')}
                  </label>
                  <select
                    id="event-type"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {eventTypeOptions().map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="event-capacity"
                    className="mb-1 block text-xs text-neutral-600 comfortaa-regular"
                  >
                    {t('eventForm.capacity')}
                  </label>
                  <Input
                    id="event-capacity"
                    inputMode="numeric"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.venue')}
                  </label>
                  <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.city')}
                  </label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.country')}
                  </label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.street')}
                  </label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('eventForm.streetPlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      {t('eventForm.latitude')}
                    </label>
                    <Input
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder={t('eventForm.latPlaceholder')}
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      {t('eventForm.longitude')}
                    </label>
                    <Input
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder={t('eventForm.lngPlaceholder')}
                      inputMode="decimal"
                    />
                  </div>
                </div>
                <div>
                  <DateTimeDialogField
                    label={t('eventForm.start')}
                    date={startDate}
                    timeHHMM={startTime}
                    onChange={(d, t) => syncStart(d, t)}
                  />
                </div>
                <div>
                  <DateTimeDialogField
                    label={t('eventForm.end')}
                    date={endDate}
                    timeHHMM={endTime}
                    onChange={(d, t) => syncEnd(d, t)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.featuredImage')}
                  </label>
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex flex-col gap-3">
                      <div className="h-32 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                        {featuredPreview ? (
                          <img
                            src={featuredPreview}
                            alt={t('eventForm.featuredPreview')}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-500 comfortaa-regular">
                            {t('eventForm.noImage')}
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={submitting}
                        onChange={(e) => {
                          const f = e.currentTarget.files?.[0];
                          onFeaturedFileChange(f);
                          e.currentTarget.value = '';
                        }}
                        className={cn(
                          'block w-full text-sm text-neutral-700 file:mr-2 file:rounded-none',
                          'file:bg-transparent file:border-2 file:border-[var(--nexus-purple)] file:px-2 file:py-1 file:text-xs file:text-[var(--nexus-purple)] file:hover:bg-[var(--nexus-purple)] file:hover:text-white',
                          'comfortaa-regular',
                        )}
                      />
                      {pendingFeaturedFile ? (
                        <p className="text-[11px] text-neutral-500 comfortaa-regular">
                          {t('eventForm.imageAfterCreate')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">
                {t('eventForm.categories')}
              </p>
              {loadingCats ? (
                <p className="mt-4 text-sm text-neutral-600 comfortaa-regular">
                  {t('eventForm.loading')}
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {categoryNames.map((name) => {
                    const checked = selectedCategories.has(name);
                    return (
                      <label
                        key={name}
                        className="flex items-center gap-2 text-sm text-neutral-700 comfortaa-regular"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleCategory(name)} />
                        {name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </OrganizerLayout>
  );
}
