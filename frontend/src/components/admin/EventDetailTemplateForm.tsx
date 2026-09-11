import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EventDetail } from '@/types/eventDetail';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/langContext';

type Props = {
  value: EventDetail;
  onChange: (next: EventDetail) => void;
  disabled?: boolean;
};

function triToString(v: boolean | null): '' | 'yes' | 'no' {
  if (v === null) return '';
  return v ? 'yes' : 'no';
}

function stringToTri(raw: string): boolean | null {
  if (raw === 'yes') return true;
  if (raw === 'no') return false;
  return null;
}

export function EventDetailTemplateForm({ value, onChange, disabled }: Props) {
  const { t } = useLang();
  const useful = value.useful ?? {
    duration_minutes: null,
    intermission_minutes: null,
    seated_only: null,
    parking_available: null,
    cancellation_policy: '',
  };
  const org = value.organizer_display ?? {
    legal_name: '',
    headquarters: '',
    vat_number: '',
    email: '',
    phone: '',
    tax_office: '',
  };

  const setUseful = (patch: Partial<NonNullable<EventDetail['useful']>>) => {
    onChange({
      ...value,
      useful: { ...useful, ...patch },
    });
  };

  const setOrg = (patch: Partial<NonNullable<EventDetail['organizer_display']>>) => {
    onChange({
      ...value,
      organizer_display: { ...org, ...patch },
    });
  };

  return (
    <div className="space-y-8 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-950 comfortaa-bold">
          {t('template.title')}
        </h2>
        <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">{t('template.hint')}</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900 comfortaa-bold">
          {t('template.contributors')}
        </h3>
        <p className="text-xs text-neutral-500 comfortaa-regular">
          {t('template.contributorsHint')}
        </p>
        <ul className="space-y-2">
          {value.contributors.map((row, i) => (
            <li key={`c-${i}`} className="flex flex-wrap gap-2 sm:flex-nowrap">
              <Input
                placeholder={t('template.role')}
                value={row.role}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...value.contributors];
                  next[i] = { ...next[i], role: e.target.value };
                  onChange({ ...value, contributors: next });
                }}
                className="sm:max-w-[200px]"
              />
              <Input
                placeholder={t('template.name')}
                value={row.name}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...value.contributors];
                  next[i] = { ...next[i], name: e.target.value };
                  onChange({ ...value, contributors: next });
                }}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="shrink-0 text-[var(--nexus-red)]"
                onClick={() => {
                  const next = value.contributors.filter((_, j) => j !== i);
                  onChange({ ...value, contributors: next });
                }}
                aria-label={t('template.remove')}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="comfortaa-regular"
          onClick={() =>
            onChange({ ...value, contributors: [...value.contributors, { role: '', name: '' }] })
          }
        >
          <Plus className="mr-1 size-4" />
          {t('template.addContributor')}
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900 comfortaa-bold">
          {t('template.artists')}
        </h3>
        <ul className="space-y-2">
          {value.artists.map((row, i) => (
            <li key={`a-${i}`} className="flex flex-wrap gap-2 sm:flex-nowrap">
              <Input
                placeholder={t('template.name')}
                value={row.name}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...value.artists];
                  next[i] = { ...next[i], name: e.target.value };
                  onChange({ ...value, artists: next });
                }}
                className="min-w-0 flex-1"
              />
              <Input
                placeholder={t('template.note')}
                value={row.role ?? ''}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...value.artists];
                  next[i] = { ...next[i], role: e.target.value || undefined };
                  onChange({ ...value, artists: next });
                }}
                className="sm:max-w-[220px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="shrink-0 text-[var(--nexus-red)]"
                onClick={() => {
                  const next = value.artists.filter((_, j) => j !== i);
                  onChange({ ...value, artists: next });
                }}
                aria-label={t('template.remove')}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="comfortaa-regular"
          onClick={() => onChange({ ...value, artists: [...value.artists, { name: '' }] })}
        >
          <Plus className="mr-1 size-4" />
          {t('template.addArtist')}
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900 comfortaa-bold">
          {t('template.useful')}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
              {t('template.duration')}
            </label>
            <Input
              type="number"
              min={0}
              value={useful.duration_minutes ?? ''}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                setUseful({ duration_minutes: v === '' ? null : Number(v) });
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
              {t('template.intermission')}
            </label>
            <Input
              type="number"
              min={0}
              value={useful.intermission_minutes ?? ''}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                setUseful({ intermission_minutes: v === '' ? null : Number(v) });
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
              {t('template.seated')}
            </label>
            <select
              className={cn(
                'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm comfortaa-regular',
                disabled && 'opacity-50',
              )}
              disabled={disabled}
              value={triToString(useful.seated_only)}
              onChange={(e) => setUseful({ seated_only: stringToTri(e.target.value) })}
            >
              <option value="">—</option>
              <option value="yes">{t('template.yes')}</option>
              <option value="no">{t('template.no')}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">Parking</label>
            <select
              className={cn(
                'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm comfortaa-regular',
                disabled && 'opacity-50',
              )}
              disabled={disabled}
              value={triToString(useful.parking_available)}
              onChange={(e) => setUseful({ parking_available: stringToTri(e.target.value) })}
            >
              <option value="">—</option>
              <option value="yes">{t('template.yes')}</option>
              <option value="no">{t('template.no')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
            {t('template.policy')}
          </label>
          <Textarea
            value={useful.cancellation_policy}
            disabled={disabled}
            onChange={(e) => setUseful({ cancellation_policy: e.target.value })}
            className="min-h-24"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900 comfortaa-bold">
          {t('template.organizer')}
        </h3>
        <p className="text-xs text-neutral-500 comfortaa-regular">{t('template.organizerHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
              {t('template.legalName')}
            </label>
            <Input
              value={org.legal_name}
              disabled={disabled}
              onChange={(e) => setOrg({ legal_name: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
              {t('template.headquarters')}
            </label>
            <Input
              value={org.headquarters}
              disabled={disabled}
              onChange={(e) => setOrg({ headquarters: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
              {t('template.vat')}
            </label>
            <Input
              value={org.vat_number}
              disabled={disabled}
              onChange={(e) => setOrg({ vat_number: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
              {t('template.taxOffice')}
            </label>
            <Input
              value={org.tax_office}
              disabled={disabled}
              onChange={(e) => setOrg({ tax_office: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">Email</label>
            <Input
              type="email"
              value={org.email}
              disabled={disabled}
              onChange={(e) => setOrg({ email: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
              {t('template.phone')}
            </label>
            <Input
              value={org.phone}
              disabled={disabled}
              onChange={(e) => setOrg({ phone: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900 comfortaa-bold">
          {t('template.dates')}
        </h3>
        <p className="text-xs text-neutral-500 comfortaa-regular">{t('template.datesHint')}</p>
        <ul className="space-y-2">
          {value.occurrences.map((row, i) => (
            <li key={`o-${i}`} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                  {t('template.startLocal')}
                </label>
                <Input
                  type="datetime-local"
                  value={toDatetimeLocal(row.starts_at)}
                  disabled={disabled}
                  onChange={(e) => {
                    const iso = fromDatetimeLocal(e.target.value);
                    const next = [...value.occurrences];
                    next[i] = { ...next[i], starts_at: iso };
                    onChange({ ...value, occurrences: next });
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs text-neutral-600 comfortaa-regular">
                  {t('template.label')}
                </label>
                <Input
                  value={row.label ?? ''}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...value.occurrences];
                    next[i] = { ...next[i], label: e.target.value || undefined };
                    onChange({ ...value, occurrences: next });
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="text-[var(--nexus-red)]"
                onClick={() => {
                  const next = value.occurrences.filter((_, j) => j !== i);
                  onChange({ ...value, occurrences: next });
                }}
                aria-label={t('template.remove')}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="comfortaa-regular"
          onClick={() =>
            onChange({
              ...value,
              occurrences: [
                ...value.occurrences,
                { starts_at: new Date().toISOString(), label: '' },
              ],
            })
          }
        >
          <Plus className="mr-1 size-4" />
          {t('template.addDate')}
        </Button>
      </section>
    </div>
  );
}

function toDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(raw: string): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}
