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
import { useAuth } from '@/hooks/useAuth';
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
import type { Event } from '@/types/models';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

type CategoryDto = { id: string; name: string };

type TicketDraft = {
  clientId: string;
  name: string;
  price: string;
  quantity: string;
};

type EventCreateResponse = {
  id: string;
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

  useEffect(() => {
    if (disabled) setClockOpen(false);
  }, [disabled]);

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
        isOpen={clockOpen}
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
        clockAriaLabel="Αναλογικό ρολόι"
        clearAriaLabel="Καθαρισμός ώρας"
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
          aria-label={`${label} επεξεργασία`}
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
              {step === 'date' ? 'Επιλέξτε ημερομηνία' : 'Επιλέξτε ώρα'}
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
                  Επόμενο →
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
                  ← Πίσω
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  className="bg-[#6d28d9] text-white hover:bg-[#5b21b6] comfortaa-regular"
                >
                  Επιβεβαίωση
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
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [capacity, setCapacity] = useState('100');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [ticketRows, setTicketRows] = useState<TicketDraft[]>([
    { clientId: '1', name: 'Γενική είσοδος', price: '0', quantity: '100' },
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

  const [loadingCats, setLoadingCats] = useState(true);
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

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/v1/categories')
      .then(async (res) => {
        const json = (await res.json()) as ApiEnvelope<CategoryDto[]>;
        if (!res.ok || json.error)
          throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης κατηγοριών');
        if (!cancelled) setCategories(json.data ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Σφάλμα');
      })
      .finally(() => {
        if (!cancelled) setLoadingCats(false);
      });
    return () => {
      cancelled = true;
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

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

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
    if (!accessToken) {
      setError('missing bearer token');
      return;
    }
    if (!startDate || !endDate) {
      setError('Ορίστε ημερομηνίες έναρξης και λήξης.');
      return;
    }
    const startAt = toUtcRfc3339(startDate, startTime);
    const endAt = toUtcRfc3339(endDate, endTime);
    if (!startAt || !endAt) {
      setError('Μη έγκυρη ώρα (χρησιμοποιήστε μορφή ΩΩ:ΛΛ).');
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError('Η λήξη πρέπει να είναι μετά την έναρξη.');
      return;
    }

    const cap = Number.parseInt(capacity.trim(), 10);
    if (!Number.isFinite(cap) || cap < 0) {
      setError('Μη έγκυρη χωρητικότητα.');
      return;
    }

    const parsedTickets = ticketRows.map((r) => ({
      name: r.name.trim(),
      price: Number.parseFloat(r.price.replace(',', '.')),
      quantity: Number.parseInt(r.quantity.trim(), 10),
    }));

    for (const t of parsedTickets) {
      if (
        t.name === '' ||
        !Number.isFinite(t.price) ||
        t.price < 0 ||
        !Number.isFinite(t.quantity) ||
        t.quantity < 0
      ) {
        setError('Συμπληρώστε έγκυρα στοιχεία για όλους τους τύπους εισιτηρίων.');
        return;
      }
    }

    const sumQty = parsedTickets.reduce((acc, t) => acc + t.quantity, 0);
    if (sumQty > cap) {
      setError(
        'Το άθροισμα των θέσεων ανά τύπο δεν μπορεί να υπερβαίνει τη συνολική χωρητικότητα.',
      );
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
      categories: Array.from(selectedCategories),
      ticket_types: parsedTickets,
      event_detail: detail,
    };
    if (latRaw !== '' && Number.isFinite(latNum)) payload.latitude = latNum;
    if (lonRaw !== '' && Number.isFinite(lonNum)) payload.longitude = lonNum;

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/events/organizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiEnvelope<EventCreateResponse>;
      if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Αποτυχία δημιουργίας');
      const id = json.data?.id;
      if (!id) throw new Error('Άκυρη απάντηση');

      if (pendingFeaturedFile) {
        const fd = new FormData();
        fd.append('file', pendingFeaturedFile);
        const upRes = await fetch(
          `/api/v1/events/organizer/${encodeURIComponent(id)}/featured-image`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: fd,
          },
        );
        const upJson = (await upRes.json()) as ApiEnvelope<Event>;
        if (!upRes.ok || upJson.error) {
          toast.error(
            'Η εκδήλωση δημιουργήθηκε, αλλά η μεταφόρτωση της εικόνας απέτυχε. Μπορείτε να προσθέσετε εικόνα από την επεξεργασία.',
          );
        }
      }

      void navigate(`/organizer/events/${encodeURIComponent(id)}/edit`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Σφάλμα');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OrganizerLayout>
      <div className="bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 comfortaa-regular">
              <Link to="/organizer/events" className="hover:underline">
                Οι εκδηλώσεις μου
              </Link>{' '}
              / Νέα εκδήλωση
            </p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950 comfortaa-bold">
              Νέα εκδήλωση
            </h1>
          </div>
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting || loadingCats}
            className="rounded-none border-2 border-[#6d28d9] bg-transparent px-4 py-1.5 text-sm text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white comfortaa-regular"
          >
            {submitting ? 'Δημιουργία…' : 'Δημιουργία'}
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
                Τίτλος
              </label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800 comfortaa-regular">
                Περιγραφή
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
                  Χάρτης τοποθεσίας
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
                Τύποι εισιτηρίων
              </p>
              <p className="mt-1 text-xs text-neutral-500 comfortaa-regular">
                Το άθροισμα των θέσεων ανά τύπο δεν μπορεί να υπερβαίνει τη συνολική χωρητικότητα.
              </p>
              <div className="mt-4 space-y-3">
                {ticketRows.map((row) => (
                  <div
                    key={row.clientId}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-100 p-3 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto]"
                  >
                    <Input
                      placeholder="Όνομα τύπου"
                      value={row.name}
                      onChange={(e) => updateTicketRow(row.clientId, { name: e.target.value })}
                    />
                    <Input
                      placeholder="Τιμή"
                      inputMode="decimal"
                      value={row.price}
                      onChange={(e) => updateTicketRow(row.clientId, { price: e.target.value })}
                    />
                    <Input
                      placeholder="Θέσεις"
                      inputMode="numeric"
                      value={row.quantity}
                      onChange={(e) => updateTicketRow(row.clientId, { quantity: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="justify-self-end text-neutral-500 hover:text-[var(--nexus-red)]"
                      aria-label="Αφαίρεση τύπου"
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
                  Προσθήκη τύπου
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">Λεπτομέρειες</p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    Χωρητικότητα
                  </label>
                  <Input
                    inputMode="numeric"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    Χώρος
                  </label>
                  <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    Πόλη
                  </label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    Χώρα
                  </label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    Διεύθυνση (οδός)
                  </label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="π.χ. Ιπποκράτους 7"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      Γεωγρ. πλάτος
                    </label>
                    <Input
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="π.χ. 37.9838"
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      Γεωγρ. μήκος
                    </label>
                    <Input
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="π.χ. 23.7275"
                      inputMode="decimal"
                    />
                  </div>
                </div>
                <div>
                  <DateTimeDialogField
                    label="Έναρξη"
                    date={startDate}
                    timeHHMM={startTime}
                    onChange={(d, t) => syncStart(d, t)}
                  />
                </div>
                <div>
                  <DateTimeDialogField
                    label="Λήξη"
                    date={endDate}
                    timeHHMM={endTime}
                    onChange={(d, t) => syncEnd(d, t)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    Εικόνα εμφάνισης (προαιρετικό)
                  </label>
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex flex-col gap-3">
                      <div className="h-32 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                        {featuredPreview ? (
                          <img
                            src={featuredPreview}
                            alt="Προεπισκόπηση εικόνας εμφάνισης"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-500 comfortaa-regular">
                            Δεν έχει επιλεγεί εικόνα
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
                          'file:bg-transparent file:border-2 file:border-[#6d28d9] file:px-2 file:py-1 file:text-xs file:text-[#6d28d9] file:hover:bg-[#6d28d9] file:hover:text-white',
                          'comfortaa-regular',
                        )}
                      />
                      {pendingFeaturedFile ? (
                        <p className="text-[11px] text-neutral-500 comfortaa-regular">
                          Η εικόνα θα μεταφορτωθεί αμέσως μετά τη δημιουργία της εκδήλωσης.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">Κατηγορίες</p>
              {loadingCats ? (
                <p className="mt-4 text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</p>
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
