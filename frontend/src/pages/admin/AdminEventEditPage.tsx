import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth } from '@/contexts/AuthContent';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import type { Event } from '@/types/models';
import { cn } from '@/lib/utils';
import { PencilIcon } from 'lucide-react';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

type CategoryDto = { id: string; name: string };

function isUUID(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
}

type FormState = {
  title: string;
  description: string;
  venue: string;
  city: string;
  country: string;
  start_at: string;
  end_at: string;
  featured_image_url: string;
  categories: Set<string>;
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
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), parsed.hour, parsed.minute, 0, 0);
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

function TimeSpinner({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const parsed = parseTimeHHMM(value) ?? { hour: 12, minute: 0 };
  const hour = parsed.hour;
  const minute = parsed.minute;

  const setHour = (h: number) => {
    const next = ((h % 24) + 24) % 24;
    onChange(`${pad2(next)}:${pad2(minute)}`);
  };
  const setMinute = (m: number) => {
    const next = ((m % 60) + 60) % 60;
    onChange(`${pad2(hour)}:${pad2(next)}`);
  };

  const incHour = (delta: number) => setHour(hour + delta);
  const incMinute = (delta: number) => setMinute(minute + delta);

  return (
    <div className={cn('flex items-center gap-3', disabled && 'opacity-60')}>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => incHour(1)}
          className="h-9 w-9 rounded-lg"
          aria-label="Αύξηση ώρας"
        >
          +
        </Button>
        <select
          value={pad2(hour)}
          disabled={disabled}
          onChange={(e) => setHour(Number(e.target.value))}
          className={cn(
            'h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm outline-none',
            'focus-visible:border-[#6d28d9] focus-visible:ring-2 focus-visible:ring-[#6d28d9]/20',
            'comfortaa-regular',
          )}
          aria-label="Ώρα"
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <option key={i} value={pad2(i)}>
              {pad2(i)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => incHour(-1)}
          className="h-9 w-9 rounded-lg"
          aria-label="Μείωση ώρας"
        >
          −
        </Button>
      </div>

      <span className="text-sm text-neutral-500 comfortaa-regular">:</span>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => incMinute(5)}
          className="h-9 w-9 rounded-lg"
          aria-label="Αύξηση λεπτών"
        >
          +
        </Button>
        <select
          value={pad2(minute)}
          disabled={disabled}
          onChange={(e) => setMinute(Number(e.target.value))}
          className={cn(
            'h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm outline-none',
            'focus-visible:border-[#6d28d9] focus-visible:ring-2 focus-visible:ring-[#6d28d9]/20',
            'comfortaa-regular',
          )}
          aria-label="Λεπτά"
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <option key={i} value={pad2(i)}>
              {pad2(i)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => incMinute(-5)}
          className="h-9 w-9 rounded-lg"
          aria-label="Μείωση λεπτών"
        >
          −
        </Button>
      </div>
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

  const uiDate = formatDateForUi(date);
  const uiValue = uiDate ? `${uiDate} ${timeHHMM}` : '';

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">{label}</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 cursor-pointer rounded-md px-0 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 comfortaa-regular"
          onClick={() => {
            setOpen(true);
          }}
          aria-label={`${label} επεξεργασία`}
        >
          <PencilIcon className="size-4" />
        </Button>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
        <p className="text-sm text-neutral-900 comfortaa-regular">{uiValue || '—'}</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="comfortaa-bold">{label}</DialogTitle>
            <DialogDescription className="comfortaa-regular">Ημερομηνία και ώρα.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Calendar mode="single" selected={date} onSelect={(d) => onChange(d, timeHHMM)} />
            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <p className="mb-2 text-xs text-neutral-600 comfortaa-regular">Ώρα</p>
              <TimeSpinner value={timeHHMM} onChange={(t) => onChange(date, t)} disabled={!date} />
            </div>
            <DialogFooter className="sm:justify-end">
              <Button
                type="button"
                className="rounded-full bg-[#6d28d9] text-white hover:bg-[#5b21b6] comfortaa-regular"
                onClick={() => setOpen(false)}
              >
                Έτοιμο
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminEventEditPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState<string>('12:00');
  const [endTime, setEndTime] = useState<string>('12:00');
  const [featuredPreview, setFeaturedPreview] = useState<string | null>(null);
  const featuredObjectUrlRef = useRef<string | null>(null);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const eventId = id ?? '';

  useEffect(() => {
    let cancelled = false;
    if (!eventId) return;
    if (!isUUID(eventId)) {
      setError('invalid event id');
      setLoading(false);
      return;
    }
    if (!accessToken) {
      setError('missing bearer token');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSaveError(null);
    setSaveOk(null);

    const load = async () => {
      const [evRes, catRes] = await Promise.all([
        fetch(`/api/v1/events/admin/${encodeURIComponent(eventId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('/api/v1/categories'),
      ]);
      const evJson = (await evRes.json()) as ApiEnvelope<Event>;
      const catJson = (await catRes.json()) as ApiEnvelope<CategoryDto[]>;

      if (!evRes.ok || evJson.error)
        throw new Error(evJson.error?.message ?? 'Σφάλμα φόρτωσης εκδήλωσης');
      if (!catRes.ok || catJson.error)
        throw new Error(catJson.error?.message ?? 'Σφάλμα φόρτωσης κατηγοριών');

      const ev = evJson.data;
      if (!ev) throw new Error('Άκυρη απάντηση');

      if (!cancelled) {
        setEvent(ev);
        setCategories(catJson.data ?? []);
        setForm({
          title: ev.title ?? '',
          description: ev.description ?? '',
          venue: ev.venue ?? '',
          city: ev.city ?? '',
          country: ev.country ?? '',
          start_at: ev.start_at ?? '',
          end_at: ev.end_at ?? '',
          featured_image_url: ev.featured_image_url ?? '',
          categories: new Set(ev.categories ?? []),
        });

        const startParsed = ev.start_at ? fromRfc3339ToDateAndTime(ev.start_at) : null;
        const endParsed = ev.end_at ? fromRfc3339ToDateAndTime(ev.end_at) : null;
        if (startParsed) {
          setStartDate(startParsed.date);
          setStartTime(startParsed.timeHHMM);
        }
        if (endParsed) {
          setEndDate(endParsed.date);
          setEndTime(endParsed.timeHHMM);
        }

        setFeaturedPreview(ev.featured_image_url ?? null);
      }
    };

    void load()
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Σφάλμα');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, accessToken]);

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
    if (!eventId) return;
    if (!accessToken) {
      setSaveError('missing bearer token');
      return;
    }
    setSaveError(null);
    setSaveOk(null);
    setUploadingFeatured(true);

    if (featuredObjectUrlRef.current) {
      URL.revokeObjectURL(featuredObjectUrlRef.current);
      featuredObjectUrlRef.current = null;
    }
    const objectUrl = URL.createObjectURL(file);
    featuredObjectUrlRef.current = objectUrl;
    setFeaturedPreview(objectUrl);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/v1/events/admin/${encodeURIComponent(eventId)}/featured-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const json = (await res.json()) as ApiEnvelope<Event>;
      if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Αποτυχία μεταφόρτωσης εικόνας');

      const next = json.data?.featured_image_url ?? '';
      setForm((prev) => (prev ? { ...prev, featured_image_url: next } : prev));
      setEvent(json.data ?? null);
      if (next) setFeaturedPreview(next);
      setSaveOk('Αποθηκεύτηκε');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Σφάλμα');
    } finally {
      setUploadingFeatured(false);
    }
  };

  const onSave = async () => {
    if (!form || !eventId) return;
    if (!accessToken) {
      setSaveError('missing bearer token');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(`/api/v1/events/admin/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          venue: form.venue,
          city: form.city,
          country: form.country || null,
          start_at: form.start_at,
          end_at: form.end_at,
          featured_image_url: form.featured_image_url || null,
          categories: Array.from(form.categories),
        }),
      });
      const json = (await res.json()) as ApiEnvelope<Event>;
      if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Αποτυχία αποθήκευσης');
      setEvent(json.data ?? null);
      setSaveOk('Αποθηκεύτηκε');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Σφάλμα');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 comfortaa-regular">
              <Link to="/admin/events" className="hover:underline">
                Εκδηλώσεις
              </Link>{' '}
              / Επεξεργασία
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold text-neutral-950 comfortaa-bold">
              {event?.title ?? 'Εκδήλωση'}
            </h1>
          </div>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={loading || saving || !form}
            className="rounded-full bg-[#6d28d9] text-white hover:bg-[#5b21b6] comfortaa-regular"
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </Button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">
            {error}
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

        {loading || !form ? (
          <p className="mt-6 text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-800 comfortaa-regular">
                  Τίτλος
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-800 comfortaa-regular">
                  Περιγραφή
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={cn(
                    'min-h-32 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none',
                    'focus-visible:border-[#6d28d9] focus-visible:ring-2 focus-visible:ring-[#6d28d9]/20',
                    'comfortaa-regular',
                  )}
                />
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-neutral-200 p-4">
                <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">
                  Λεπτομέρειες
                </p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      Χώρος
                    </label>
                    <Input
                      value={form.venue}
                      onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      Πόλη
                    </label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                      Χώρα
                    </label>
                    <Input
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    />
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
                              'block w-full text-sm text-neutral-700 file:mr-3 file:rounded-full file:border-0',
                              'file:bg-[#6d28d9] file:px-3 file:py-2 file:text-white file:hover:bg-[#5b21b6]',
                              'comfortaa-regular',
                            )}
                          />
                          <p className="mt-2 text-[11px] text-neutral-500 comfortaa-regular">
                            {uploadingFeatured ? 'Μεταφόρτωση…' : form.featured_image_url ? form.featured_image_url : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 p-4">
                <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">Κατηγορίες</p>
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
        )}
      </div>
    </AdminLayout>
  );
}
