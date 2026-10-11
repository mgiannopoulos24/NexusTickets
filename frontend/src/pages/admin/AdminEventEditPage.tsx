import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EventDetailTemplateForm } from '@/components/admin/EventDetailTemplateForm';
import { LocationPicker } from '@/components/events/LocationPicker';
import { AdminLayout } from '@/components/layout/AdminLayout';
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
import { normalizeEventDetail } from '@/types/eventDetail';
import type { Category, Event } from '@/types/models';
import type { EventStatus } from '@/types/enums';

/** Admin may set draft / published / cancelled (matches API). */
const ADMIN_EVENT_STATUS_VALUES = ['draft', 'published', 'completed', 'cancelled'] as const;
type AdminEventStatus = (typeof ADMIN_EVENT_STATUS_VALUES)[number];

function normalizeAdminEventStatus(raw: string): AdminEventStatus {
  return (ADMIN_EVENT_STATUS_VALUES as readonly string[]).includes(raw)
    ? (raw as AdminEventStatus)
    : 'draft';
}
import { PencilIcon } from 'lucide-react';

import { apiErrorMessage } from '@/app/apiEnvelope';
import {
  useAdminUpdateEventMutation,
  useGetAdminEventQuery,
  useListCategoriesQuery,
  useUploadFeaturedImageMutation,
  type EventWritePayload,
} from '@/app/eventsApi';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';

import { DEFAULT_EVENT_TYPE, eventTypeOptions } from '@/constants/eventTypes';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import { useLang } from '@/contexts/langContextCore';
import { tr } from '@/lib/i18n';

function isUUID(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
}

type FormState = {
  title: string;
  description: string;
  venue: string;
  address: string;
  city: string;
  country: string;
  /** Decimal degrees as typed in the form (WGS84). Empty = omit on save (keep DB value). */
  latitude: string;
  longitude: string;
  start_at: string;
  end_at: string;
  featured_image_url: string;
  /** draft | published | cancelled */
  status: AdminEventStatus;
  categories: Set<string>;
  event_type: string;
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

function fromRfc3339ToDateAndTime(raw: string): { date: Date; timeHHMM: string } | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const timeHHMM = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return { date, timeHHMM };
}

function formatDateForUi(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('el-GR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function AdminTimePicker({
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
        /* Stack inputs + analog clock; lift clock above dialog stacking (react-time-picker + react-clock) */
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
              <AdminTimePicker value={tempTime} onChange={setTempTime} disabled={!tempDate} />
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

/** Builds the editable form state from a freshly loaded event. */
function formFromEvent(ev: Event): FormState {
  return {
    title: ev.title ?? '',
    description: ev.description ?? '',
    venue: ev.venue ?? '',
    address: ev.address ?? '',
    city: ev.city ?? '',
    country: ev.country ?? '',
    latitude: ev.latitude != null && Number.isFinite(ev.latitude) ? String(ev.latitude) : '',
    longitude: ev.longitude != null && Number.isFinite(ev.longitude) ? String(ev.longitude) : '',
    start_at: ev.start_at ?? '',
    end_at: ev.end_at ?? '',
    featured_image_url: ev.featured_image_url ?? '',
    status: normalizeAdminEventStatus(ev.status as EventStatus),
    categories: new Set(ev.categories ?? []),
    event_type: ev.event_type || DEFAULT_EVENT_TYPE,
  };
}

/**
 * Loads the event and categories, then hands them to the form, which is keyed
 * by event id so its state seeds from props on mount rather than being copied
 * in from an effect.
 */
export default function AdminEventEditPage() {
  const { t } = useLang();
  const { id = '' } = useParams();

  const validId = isUUID(id);
  const eventQuery = useGetAdminEventQuery(id, { skip: !validId });
  const { data: categories } = useListCategoriesQuery();
  const event = eventQuery.data;

  if (!validId) {
    return (
      <AdminLayout>
        <div className="p-6">
          <ErrorMessage message={t('eventForm.invalidId')} />
        </div>
      </AdminLayout>
    );
  }

  if (eventQuery.isLoading || !categories) {
    return (
      <AdminLayout>
        <div className="p-6">
          <SkeletonList rows={8} />
        </div>
      </AdminLayout>
    );
  }

  if (eventQuery.error || !event) {
    return (
      <AdminLayout>
        <div className="p-6">
          <ErrorMessage
            message={apiErrorMessage(eventQuery.error, t('eventForm.loadError'))}
            onRetry={() => void eventQuery.refetch()}
          />
        </div>
      </AdminLayout>
    );
  }

  return <AdminEventEditForm key={event.id} initialEvent={event} categories={categories} />;
}

function AdminEventEditForm({
  initialEvent,
  categories,
}: {
  initialEvent: Event;
  categories: Category[];
}) {
  const { t } = useLang();
  const eventId = initialEvent.id;

  const [adminUpdateEvent] = useAdminUpdateEventMutation();
  const [uploadFeaturedImage] = useUploadFeaturedImageMutation();

  const [event, setEvent] = useState<Event>(initialEvent);
  const [form, setForm] = useState<FormState>(() => formFromEvent(initialEvent));

  const initialStart = initialEvent.start_at
    ? fromRfc3339ToDateAndTime(initialEvent.start_at)
    : null;
  const initialEnd = initialEvent.end_at ? fromRfc3339ToDateAndTime(initialEvent.end_at) : null;

  const [startDate, setStartDate] = useState<Date | undefined>(initialStart?.date);
  const [endDate, setEndDate] = useState<Date | undefined>(initialEnd?.date);
  const [startTime, setStartTime] = useState<string>(initialStart?.timeHHMM ?? '12:00');
  const [endTime, setEndTime] = useState<string>(initialEnd?.timeHHMM ?? '12:00');
  const [featuredPreview, setFeaturedPreview] = useState<string | null>(
    initialEvent.featured_image_url ?? null,
  );
  const featuredObjectUrlRef = useRef<string | null>(null);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail>(() =>
    normalizeEventDetail(initialEvent.event_detail),
  );

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  const toggleCategory = (name: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.categories);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...prev, categories: next };
    });
  };

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
    if (!nextDate) return;
    const next = toUtcRfc3339(nextDate, nextTime);
    if (!next) return;
    setForm((prev) => (prev ? { ...prev, start_at: next } : prev));
  };

  const syncEnd = (nextDate: Date | undefined, nextTime: string) => {
    setEndDate(nextDate);
    setEndTime(nextTime);
    if (!nextDate) return;
    const next = toUtcRfc3339(nextDate, nextTime);
    if (!next) return;
    setForm((prev) => (prev ? { ...prev, end_at: next } : prev));
  };

  const onUploadFeatured = async (file: File) => {
    setSaveError(null);
    setSaveOk(null);
    setUploadingFeatured(true);

    // Show the local file straight away; swap to the stored URL once saved.
    if (featuredObjectUrlRef.current) {
      URL.revokeObjectURL(featuredObjectUrlRef.current);
      featuredObjectUrlRef.current = null;
    }
    const objectUrl = URL.createObjectURL(file);
    featuredObjectUrlRef.current = objectUrl;
    setFeaturedPreview(objectUrl);

    try {
      const saved = await uploadFeaturedImage({ id: eventId, file, admin: true }).unwrap();
      const next = saved.featured_image_url ?? '';
      setForm((prev) => ({ ...prev, featured_image_url: next }));
      setEvent(saved);
      if (next) setFeaturedPreview(next);
      setSaveOk(t('eventForm.saved'));
    } catch (e: unknown) {
      setSaveError(apiErrorMessage(e, t('eventForm.imageUploadFailed')));
      if (featuredObjectUrlRef.current) {
        URL.revokeObjectURL(featuredObjectUrlRef.current);
        featuredObjectUrlRef.current = null;
      }
      setFeaturedPreview(form.featured_image_url?.trim() || null);
    } finally {
      setUploadingFeatured(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const latRaw = form.latitude.trim().replace(',', '.');
      const lonRaw = form.longitude.trim().replace(',', '.');
      const latNum = latRaw === '' ? Number.NaN : Number.parseFloat(latRaw);
      const lonNum = lonRaw === '' ? Number.NaN : Number.parseFloat(lonRaw);

      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        venue: form.venue,
        city: form.city,
        country: form.country || null,
        address: form.address.trim() || null,
        start_at: form.start_at,
        end_at: form.end_at,
        featured_image_url: form.featured_image_url || null,
        categories: Array.from(form.categories),
        event_detail: detail,
        status: form.status,
        event_type: form.event_type,
      };
      if (latRaw !== '' && Number.isFinite(latNum)) payload.latitude = latNum;
      if (lonRaw !== '' && Number.isFinite(lonNum)) payload.longitude = lonNum;

      const saved = await adminUpdateEvent({
        id: eventId,
        body: payload as Partial<EventWritePayload>,
      }).unwrap();

      setEvent(saved);
      setDetail(normalizeEventDetail(saved.event_detail));
      // The server may normalise the status (e.g. the completion sweeper), so
      // read it back rather than trusting what was sent.
      setForm((prev) => ({
        ...prev,
        status: normalizeAdminEventStatus(saved.status as EventStatus),
      }));
      setSaveOk(t('eventForm.saved'));
    } catch (e: unknown) {
      setSaveError(apiErrorMessage(e, t('eventForm.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 comfortaa-regular">
              <Link to="/admin/events" className="hover:underline">
                {t('eventForm.events')}
              </Link>{' '}
              / {t('eventForm.editCrumb')}
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold text-neutral-950 comfortaa-bold">
              {event?.title ?? t('eventForm.event')}
            </h1>
          </div>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="rounded-none border-2 border-[var(--nexus-purple)] bg-transparent px-4 py-1.5 text-sm text-[var(--nexus-purple)] hover:bg-[var(--nexus-purple)] hover:text-white comfortaa-regular"
          >
            {saving ? t('eventForm.saving') : t('eventForm.save')}
          </Button>
        </div>

        {saveError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">
            {saveError}
          </p>
        )}
        {saveOk && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {saveOk}
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800 comfortaa-regular">
                {t('eventForm.title')}
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800 comfortaa-regular">
                {t('eventForm.description')}
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-32"
              />
            </div>
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <p className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-800 comfortaa-bold">
                {t('eventForm.map')}
              </p>
              <div className="p-3">
                <LocationPicker
                  value={form}
                  onChange={(p) => setForm((f) => ({ ...f, ...p }))}
                  disabled={saving}
                />
              </div>
            </div>
            <EventDetailTemplateForm value={detail} onChange={setDetail} disabled={saving} />
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">
                {t('eventForm.details')}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.status')}
                  </label>
                  <select
                    value={form.status}
                    disabled={saving}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as AdminEventStatus,
                      })
                    }
                    className={cn(
                      'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm comfortaa-regular',
                      saving && 'opacity-50',
                    )}
                  >
                    <option value="draft">{t('status.event.draft')}</option>
                    <option value="published">{t('status.event.published')}</option>
                    <option value="completed">{t('status.event.completed')}</option>
                    <option value="cancelled">{t('status.event.cancelled')}</option>
                  </select>
                  <p className="mt-1 text-[10px] text-neutral-500 comfortaa-regular">
                    {t('eventForm.statusHintAdmin')}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="admin-event-type"
                    className="mb-1 block text-xs text-neutral-600 comfortaa-regular"
                  >
                    {t('eventForm.eventType')}
                  </label>
                  <select
                    id="admin-event-type"
                    value={form.event_type}
                    disabled={saving}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                    className={cn(
                      'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm comfortaa-regular',
                      saving && 'opacity-50',
                    )}
                  >
                    {eventTypeOptions().map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.venue')}
                  </label>
                  <Input
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.city')}
                  </label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.country')}
                  </label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                    {t('eventForm.street')}
                  </label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder={t('eventForm.streetPlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      {t('eventForm.latitudeLong')}
                    </label>
                    <Input
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      placeholder={t('eventForm.latPlaceholder')}
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      {t('eventForm.longitudeLong')}
                    </label>
                    <Input
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
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
                    Featured image
                  </label>
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex flex-col gap-3">
                      <div className="h-32 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                        {featuredPreview ? (
                          <img
                            src={featuredPreview}
                            alt="Featured preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-500 comfortaa-regular">
                            No image
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingFeatured}
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0];
                            if (f) void onUploadFeatured(f);
                            e.currentTarget.value = '';
                          }}
                          className={cn(
                            'block w-full text-sm text-neutral-700 file:mr-2 file:rounded-none',
                            'file:bg-transparent file:border-2 file:border-[var(--nexus-purple)] file:px-2 file:py-1 file:text-xs file:text-[var(--nexus-purple)] file:hover:bg-[var(--nexus-purple)] file:hover:text-white',
                            'comfortaa-regular',
                          )}
                        />
                        <p className="mt-2 text-[11px] text-neutral-500 comfortaa-regular">
                          {uploadingFeatured
                            ? t('eventForm.uploading')
                            : form.featured_image_url
                              ? form.featured_image_url
                              : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">
                {t('eventForm.categories')}
              </p>
              <div className="mt-4 space-y-2">
                {categoryNames.map((name) => {
                  const checked = form.categories.has(name);
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
            </div>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
