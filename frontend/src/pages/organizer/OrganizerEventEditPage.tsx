import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EventDetailTemplateForm } from '@/components/admin/EventDetailTemplateForm';
import { EventMapEmbed } from '@/components/events/EventMapEmbed';
import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import { apiErrorMessage } from '@/app/apiEnvelope';
import {
  useCancelEventMutation,
  useDeleteEventPhotoMutation,
  useGetEventQuery,
  useListCategoriesQuery,
  usePublishEventMutation,
  useUpdateEventMutation,
  useUploadEventPhotoMutation,
  useUploadFeaturedImageMutation,
  type EventWritePayload,
} from '@/app/eventsApi';
import { TicketTypesEditor } from '@/components/events/TicketTypesEditor';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import {
  parseTicketDrafts,
  ticketTypesToDrafts,
  type TicketTypeDraft,
} from '@/lib/ticketTypeDrafts';
import { DEFAULT_EVENT_TYPE, eventTypeOptions } from '@/constants/eventTypes';
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
import { normalizeEventDetail } from '@/types/eventDetail';
import type { Category, Event } from '@/types/models';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import { useLang } from '@/contexts/langContext';
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
  categories: Set<string>;
  event_type: string;
  capacity: string;
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
    categories: new Set(ev.categories ?? []),
    event_type: ev.event_type || DEFAULT_EVENT_TYPE,
    capacity: String(ev.capacity ?? 0),
  };
}

/**
 * Loads the event and the category list, then hands them to the form.
 *
 * The form is keyed by event id so switching events remounts it and its state
 * re-seeds from the new props — React's own answer to "reset state when the
 * data changes", instead of copying the response into state from an effect.
 */
export default function OrganizerEventEditPage() {
  const { t } = useLang();
  const { id = '' } = useParams();
  const { user } = useAuth();

  const validId = isUUID(id);
  const eventQuery = useGetEventQuery(id, { skip: !validId });
  const { data: categories } = useListCategoriesQuery();

  const event = eventQuery.data;
  const notMine = !!event && !!user && event.organizer_id !== user.id;

  if (!validId) {
    return (
      <OrganizerLayout>
        <div className="p-6">
          <ErrorMessage message={t('eventForm.invalidId')} />
        </div>
      </OrganizerLayout>
    );
  }

  if (eventQuery.isLoading || !categories) {
    return (
      <OrganizerLayout>
        <div className="p-6">
          <SkeletonList rows={8} />
        </div>
      </OrganizerLayout>
    );
  }

  if (eventQuery.error || !event) {
    return (
      <OrganizerLayout>
        <div className="p-6">
          <ErrorMessage
            message={apiErrorMessage(eventQuery.error, t('eventForm.loadError'))}
            onRetry={() => void eventQuery.refetch()}
          />
        </div>
      </OrganizerLayout>
    );
  }

  if (notMine) {
    return (
      <OrganizerLayout>
        <div className="p-6">
          <ErrorMessage message={t('eventForm.forbidden')} />
        </div>
      </OrganizerLayout>
    );
  }

  return <OrganizerEventEditForm key={event.id} initialEvent={event} categories={categories} />;
}

function OrganizerEventEditForm({
  initialEvent,
  categories,
}: {
  initialEvent: Event;
  categories: Category[];
}) {
  const { t } = useLang();
  const eventId = initialEvent.id;

  const [updateEvent] = useUpdateEventMutation();
  const [publishEvent] = usePublishEventMutation();
  const [cancelEvent] = useCancelEventMutation();
  const [uploadFeaturedImage] = useUploadFeaturedImageMutation();
  const [uploadPhoto, { isLoading: uploadingPhoto }] = useUploadEventPhotoMutation();
  const [deletePhoto] = useDeleteEventPhotoMutation();
  const { refetch: refetchEvent } = useGetEventQuery(eventId);

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
  const [ticketDrafts, setTicketDrafts] = useState<TicketTypeDraft[]>(() =>
    ticketTypesToDrafts(initialEvent.ticket_types ?? []),
  );

  // A cancelled or completed event is a historical record: the API rejects
  // edits to it, so the form is shown read-only rather than failing on save.
  const isLocked = event?.status === 'cancelled' || event?.status === 'completed';
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  const mapPreviewCoords = useMemo(() => {
    if (!form) return null;
    const latRaw = form.latitude.trim().replace(',', '.');
    const lonRaw = form.longitude.trim().replace(',', '.');
    if (latRaw === '' || lonRaw === '') return null;
    const lat = Number.parseFloat(latRaw);
    const lon = Number.parseFloat(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  }, [form]);

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
      const saved = await uploadFeaturedImage({ id: eventId, file }).unwrap();
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

  /** Adds one image to the event's gallery (DTD <Media><Photo>). */
  const onUploadPhoto = async (file: File) => {
    setSaveError(null);
    setSaveOk(null);
    try {
      await uploadPhoto({ id: eventId, file }).unwrap();
      await refreshEvent();
      setSaveOk(t('eventForm.photoAdded'));
    } catch (e: unknown) {
      setSaveError(apiErrorMessage(e, t('eventForm.photoUploadFailed')));
    }
  };

  const onDeletePhoto = async (photoId: string) => {
    setSaveError(null);
    setSaveOk(null);
    try {
      await deletePhoto({ id: eventId, photoId }).unwrap();
      await refreshEvent();
      setSaveOk(t('eventForm.photoDeleted'));
    } catch (e: unknown) {
      setSaveError(apiErrorMessage(e, t('eventForm.photoDeleteFailed')));
    }
  };

  /** Re-reads the event so gallery changes show without a page reload. */
  const refreshEvent = async () => {
    const fresh = await refetchEvent().unwrap();
    setEvent(fresh);
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

      const capacityNum = Number.parseInt(form.capacity.trim(), 10);
      if (!Number.isFinite(capacityNum) || capacityNum < 0) {
        setSaveError(t('eventForm.v.capacity'));
        setSaving(false);
        return;
      }
      if (form.categories.size === 0) {
        setSaveError(t('eventForm.v.category'));
        setSaving(false);
        return;
      }

      const parsed = parseTicketDrafts(ticketDrafts, capacityNum);
      if ('error' in parsed) {
        setSaveError(parsed.error);
        setSaving(false);
        return;
      }

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
        event_type: form.event_type,
        capacity: capacityNum,
        ticket_types: parsed.tickets,
        event_detail: detail,
      };
      if (latRaw !== '' && Number.isFinite(latNum)) payload.latitude = latNum;
      if (lonRaw !== '' && Number.isFinite(lonNum)) payload.longitude = lonNum;

      const saved = await updateEvent({
        id: eventId,
        body: payload as Partial<EventWritePayload>,
      }).unwrap();

      setEvent(saved);
      setDetail(normalizeEventDetail(saved.event_detail));
      // New ticket types come back with server ids; re-seed so a second save
      // updates them instead of creating duplicates.
      setTicketDrafts(ticketTypesToDrafts(saved.ticket_types ?? []));
      setSaveOk(t('eventForm.saved'));
    } catch (e: unknown) {
      setSaveError(apiErrorMessage(e, t('eventForm.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (s: string | undefined): string => {
    if (s === 'draft') return t('status.event.draft');
    if (s === 'published') return t('status.event.published');
    if (s === 'cancelled') return t('status.event.cancelled');
    if (s === 'completed') return t('status.event.completed');
    return s ?? '—';
  };

  const onPublish = async () => {
    setLifecycleLoading(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      setEvent(await publishEvent(eventId).unwrap());
      setSaveOk(t('eventForm.published'));
    } catch (e: unknown) {
      setSaveError(apiErrorMessage(e, t('eventForm.publishFailed')));
    } finally {
      setLifecycleLoading(false);
    }
  };

  const onCancelEvent = async () => {
    if (!window.confirm(t('eventForm.confirmCancel'))) {
      return;
    }
    setLifecycleLoading(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      setEvent(await cancelEvent(eventId).unwrap());
      setSaveOk(t('eventForm.cancelled'));
    } catch (e: unknown) {
      setSaveError(apiErrorMessage(e, t('eventForm.cancelFailed')));
    } finally {
      setLifecycleLoading(false);
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
              / {t('eventForm.editCrumb')}
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold text-neutral-950 comfortaa-bold">
              {event?.title ?? t('eventForm.event')}
            </h1>
          </div>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || lifecycleLoading || isLocked}
            className="rounded-none border-2 border-[var(--nexus-purple)] bg-transparent px-4 py-1.5 text-sm text-[var(--nexus-purple)] hover:bg-[var(--nexus-purple)] hover:text-white comfortaa-regular"
          >
            {saving ? t('eventForm.saving') : t('eventForm.save')}
          </Button>
        </div>

        {isLocked && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 comfortaa-regular">
            {event?.status === 'cancelled'
              ? t('eventForm.lockedCancelled')
              : t('eventForm.lockedCompleted')}
          </p>
        )}

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
                  <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 comfortaa-regular">
                    {statusLabel(event?.status)}
                  </p>
                  <p className="mt-1 text-[10px] text-neutral-500 comfortaa-regular">
                    {t('eventForm.statusHintOrganizer')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event?.status === 'draft' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving || lifecycleLoading}
                        onClick={() => void onPublish()}
                        className="comfortaa-regular"
                      >
                        {lifecycleLoading ? '…' : t('eventForm.publish')}
                      </Button>
                    ) : null}
                    {event?.status === 'published' ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={saving || lifecycleLoading}
                        onClick={() => void onCancelEvent()}
                        className="comfortaa-regular"
                      >
                        {lifecycleLoading ? '…' : t('eventForm.cancelEvent')}
                      </Button>
                    ) : null}
                  </div>
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
                {t('eventForm.typeAndCapacity')}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="edit-event-type"
                    className="mb-1 block text-xs text-neutral-600 comfortaa-regular"
                  >
                    {t('eventForm.eventType')}
                  </label>
                  <select
                    id="edit-event-type"
                    value={form.event_type}
                    disabled={isLocked}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
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
                    htmlFor="edit-capacity"
                    className="mb-1 block text-xs text-neutral-600 comfortaa-regular"
                  >
                    {t('eventForm.capacity')}
                  </label>
                  <Input
                    id="edit-capacity"
                    inputMode="numeric"
                    value={form.capacity}
                    disabled={isLocked}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  />
                  <p className="mt-1 text-[10px] text-neutral-500 comfortaa-regular">
                    {t('eventForm.seatsSummary', {
                      sold: event?.tickets_sold ?? 0,
                      remaining: event?.tickets_remaining ?? 0,
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">
                {t('eventForm.ticketTypes')}
              </p>
              <p className="mt-1 text-[10px] text-neutral-500 comfortaa-regular">
                {t('eventForm.ticketTypesEditHint')}
              </p>
              <TicketTypesEditor
                className="mt-4"
                drafts={ticketDrafts}
                onChange={setTicketDrafts}
                capacity={Number.parseInt(form.capacity.trim(), 10) || 0}
                disabled={isLocked}
              />
            </div>

            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">
                {t('eventForm.gallery')}
              </p>
              <p className="mt-1 text-[10px] text-neutral-500 comfortaa-regular">
                {t('eventForm.galleryHint')}
              </p>

              {(event?.photos?.length ?? 0) > 0 ? (
                <ul className="mt-3 grid grid-cols-3 gap-2">
                  {(event?.photos ?? []).map((photo, i) => (
                    <li key={photo.id} className="group relative">
                      <img
                        src={photo.url}
                        alt={t('eventForm.photoN', { n: i + 1 })}
                        className="aspect-square w-full rounded-lg border border-neutral-200 object-cover"
                      />
                      <button
                        type="button"
                        aria-label={t('eventForm.deletePhotoN', { n: i + 1 })}
                        disabled={isLocked}
                        onClick={() => void onDeletePhoto(photo.id)}
                        className={cn(
                          'absolute top-1 right-1 rounded-full bg-white/90 p-1 text-[var(--nexus-red)] shadow-sm',
                          'transition-opacity hover:bg-white disabled:cursor-not-allowed disabled:opacity-40',
                        )}
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-neutral-500 comfortaa-regular">
                  {t('eventForm.noPhotos')}
                </p>
              )}

              <input
                type="file"
                accept="image/*"
                disabled={uploadingPhoto || isLocked}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) void onUploadPhoto(f);
                  e.currentTarget.value = '';
                }}
                className={cn(
                  'mt-3 block w-full text-sm text-neutral-700 file:mr-2 file:rounded-none',
                  'file:bg-transparent file:border-2 file:border-[var(--nexus-purple)] file:px-2 file:py-1 file:text-xs file:text-[var(--nexus-purple)] file:hover:bg-[var(--nexus-purple)] file:hover:text-white',
                  'comfortaa-regular',
                )}
              />
              {uploadingPhoto && (
                <p className="mt-2 text-[11px] text-neutral-500 comfortaa-regular">
                  {t('eventForm.uploading')}
                </p>
              )}
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
                      <Checkbox
                        checked={checked}
                        disabled={isLocked}
                        onCheckedChange={() => toggleCategory(name)}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </OrganizerLayout>
  );
}
