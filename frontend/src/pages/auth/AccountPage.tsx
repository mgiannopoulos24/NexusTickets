import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useGetMeQuery, useUpdateMeMutation } from '@/app/usersApi';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocationPicker } from '@/components/events/LocationPicker';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import type { User } from '@/types/models';
import { useLang } from '@/contexts/langContextCore';

function coordToNull(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  vat_number: string;
};

/** The saved profile, rendered as form strings. */
function formFromUser(u: User | undefined): ProfileForm {
  return {
    first_name: u?.first_name ?? '',
    last_name: u?.last_name ?? '',
    email: u?.email ?? '',
    phone: u?.phone ?? '',
    address: u?.address ?? '',
    city: u?.city ?? '',
    country: u?.country ?? '',
    latitude: u?.latitude != null ? String(u.latitude) : '',
    longitude: u?.longitude != null ? String(u.longitude) : '',
    vat_number: u?.vat_number ?? '',
  };
}

export default function AccountPage() {
  const { t } = useLang();
  const { setUser } = useAuth();
  const { data: user, isLoading, error, refetch } = useGetMeQuery();
  const [updateMe, { isLoading: saving }] = useUpdateMeMutation();

  // Only the fields the user has actually touched live in state; everything
  // else reads through from the query. That keeps the form in step with the
  // server without copying the response into state in an effect.
  const [edits, setEdits] = useState<Partial<ProfileForm>>({});

  const saved = useMemo(() => formFromUser(user), [user]);
  const form: ProfileForm = { ...saved, ...edits };
  const setField = (key: keyof ProfileForm, value: string) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateMe({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        latitude: coordToNull(form.latitude),
        longitude: coordToNull(form.longitude),
        vat_number: form.vat_number || null,
      }).unwrap();

      setUser(updated);
      setEdits({}); // the query result is now the source of truth again
      toast.success(t('account.saved'));
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, t('account.saveFailed')));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="mx-auto max-w-2xl px-4">
          <SkeletonList rows={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="mx-auto max-w-2xl px-4">
          <ErrorMessage
            message={apiErrorMessage(error, t('account.loadError'))}
            onRetry={() => void refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 comfortaa-bold">
              {t('account.title')}
            </h1>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              {t('account.subtitle')}
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex shrink-0 items-center justify-center rounded-none border-2 border-[var(--nexus-purple)] bg-[var(--nexus-purple)] px-4 py-2 text-sm text-white hover:bg-[var(--nexus-purple-dark)] comfortaa-regular"
          >
            {t('account.settings')}
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 text-xl font-bold text-neutral-600">
              {user?.first_name?.[0] || user?.username?.[0] || '?'}
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900 comfortaa-regular">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-sm text-neutral-500 comfortaa-regular">@{user?.username}</p>
              <p className="text-xs text-neutral-400 comfortaa-regular">
                {t('account.role', { role: t(`role.${user?.role ?? 'attendee'}`) })}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="comfortaa-regular">
                  {t('account.firstName')}
                </Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setField('first_name', e.target.value)}
                  className="comfortaa-regular"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="comfortaa-regular">
                  {t('account.lastName')}
                </Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setField('last_name', e.target.value)}
                  className="comfortaa-regular"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="comfortaa-regular">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                className="comfortaa-regular"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="comfortaa-regular">
                {t('account.phone')}
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className="comfortaa-regular"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="comfortaa-regular">
                {t('account.address')}
              </Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                className="comfortaa-regular"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city" className="comfortaa-regular">
                  {t('account.city')}
                </Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  className="comfortaa-regular"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country" className="comfortaa-regular">
                  {t('account.country')}
                </Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => setField('country', e.target.value)}
                  className="comfortaa-regular"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="latitude" className="comfortaa-regular">
                  {t('account.latitude')}
                </Label>
                <Input
                  id="latitude"
                  inputMode="decimal"
                  placeholder={t('register.latPlaceholder')}
                  value={form.latitude}
                  onChange={(e) => setField('latitude', e.target.value)}
                  className="comfortaa-regular"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude" className="comfortaa-regular">
                  {t('account.longitude')}
                </Label>
                <Input
                  id="longitude"
                  inputMode="decimal"
                  placeholder={t('register.lngPlaceholder')}
                  value={form.longitude}
                  onChange={(e) => setField('longitude', e.target.value)}
                  className="comfortaa-regular"
                />
              </div>
            </div>

            <LocationPicker
              value={form}
              onChange={(p) => setEdits((prev) => ({ ...prev, ...p }))}
              disabled={saving}
            />

            <div className="space-y-2">
              <Label htmlFor="vat_number" className="comfortaa-regular">
                {t('account.vat')}
              </Label>
              <Input
                id="vat_number"
                value={form.vat_number}
                onChange={(e) => setField('vat_number', e.target.value)}
                className="comfortaa-regular"
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-[var(--nexus-purple)] text-white hover:bg-[var(--nexus-purple-dark)] comfortaa-regular"
            >
              {saving ? t('account.saving') : t('account.save')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
