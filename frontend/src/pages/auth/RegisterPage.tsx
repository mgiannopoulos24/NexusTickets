import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EventMapEmbed } from '@/components/events/EventMapEmbed';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/langContext';
import { tr } from '@/lib/i18n';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

function stringToNull(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

function coordToNull(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function makeSchema(t: (key: string) => string) {
  return z
    .object({
      username: z.string().trim().min(3, t('register.v.username')),
      password: z
        .string()
        .min(8, t('register.v.passwordMin'))
        .max(72, t('register.v.passwordMax'))
        .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), {
          message: t('register.v.passwordMix'),
        }),
      confirm_password: z.string().min(1, t('register.v.confirm')),
      first_name: z.string().trim().min(1, t('register.v.firstName')),
      last_name: z.string().trim().min(1, t('register.v.lastName')),
      email: z.string().trim().email(t('register.v.email')),
      phone: z.string().refine(
        (v) => {
          const t = v.trim();
          if (t === '') return true;
          const digits = (t.match(/\d/g) ?? []).length;
          return /^\+?[\d(][\d\s().-]*$/.test(t) && digits >= 8 && digits <= 15;
        },
        { message: t('register.v.phone') },
      ),
      address: z.string(),
      city: z.string(),
      country: z.string(),
      latitude: z.string(),
      longitude: z.string(),
      vat_number: z.string().refine((v) => v.trim() === '' || /^\d{9}$/.test(v.trim()), {
        message: t('register.v.vat'),
      }),
      role: z.enum(['attendee', 'organizer']),
    })
    .refine((v) => v.password === v.confirm_password, {
      message: t('register.v.mismatch'),
      path: ['confirm_password'],
    });
}

type RegisterForm = z.infer<ReturnType<typeof makeSchema>>;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

function mapRegisterError(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('username already taken')) return tr('register.e.usernameTaken');
  if (msg.includes('email already taken')) return tr('register.e.emailTaken');
  if (msg.includes('missing required registration fields')) return tr('register.e.required');
  if (msg.includes('email address is not valid')) return tr('register.e.email');
  if (msg.includes('phone number is not valid')) return tr('register.e.phone');
  if (msg.includes('VAT number')) return tr('register.e.vat');
  if (msg.includes('password must')) return tr('register.e.password');
  if (msg.includes('role must be')) return tr('register.e.role');
  return tr('register.e.generic');
}

async function checkUsernameAvailable(username: string): Promise<boolean> {
  const res = await fetch(
    `/api/v1/auth/username-available?username=${encodeURIComponent(username.trim())}`,
  );
  const json = (await res.json()) as ApiEnvelope<{ available: boolean }>;
  if (!res.ok || json.error || !json.data) {
    throw new Error(json.error?.message ?? tr('register.e.usernameCheck'));
  }
  return json.data.available;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount, user } = useAuth();
  const { t } = useLang();
  const registerSchema = useMemo(() => makeSchema(t), [t]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameHint, setUsernameHint] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
      confirm_password: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      latitude: '',
      longitude: '',
      vat_number: '',
      role: 'attendee',
    },
  });

  const usernameValue = watch('username');
  const roleValue = watch('role');
  const latitudeValue = watch('latitude');
  const longitudeValue = watch('longitude');

  const mapPreviewCoords = useMemo(() => {
    const latRaw = latitudeValue.trim().replace(',', '.');
    const lonRaw = longitudeValue.trim().replace(',', '.');
    if (latRaw === '' || lonRaw === '') return null;
    const lat = Number.parseFloat(latRaw);
    const lon = Number.parseFloat(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  }, [latitudeValue, longitudeValue]);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const canCheckUsername = useMemo(() => usernameValue.trim().length >= 3, [usernameValue]);

  useEffect(() => {
    setUsernameHint(null);
    if (!canCheckUsername) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    const handle = window.setTimeout(() => {
      void checkUsernameAvailable(usernameValue)
        .then((available) => {
          setUsernameStatus(available ? 'available' : 'taken');
          setUsernameHint(
            available ? t('register.usernameAvailable') : t('register.usernameTaken'),
          );
          if (!available) {
            setError('username', {
              type: 'validate',
              message: t('register.usernameTaken'),
            });
          } else {
            clearErrors('username');
          }
        })
        .catch(() => {
          setUsernameStatus('error');
          setUsernameHint(t('register.usernameCheckFailed'));
        });
    }, 450);

    return () => window.clearTimeout(handle);
  }, [usernameValue, canCheckUsername, setError, clearErrors]);

  const onSubmit = async (data: RegisterForm) => {
    setSubmitError(null);

    const normalizedUsername = data.username.trim();
    if (normalizedUsername.length >= 3) {
      try {
        const available = await checkUsernameAvailable(normalizedUsername);
        if (!available) {
          setUsernameStatus('taken');
          setUsernameHint(t('register.usernameTaken'));
          setError('username', {
            type: 'validate',
            message: t('register.usernameTaken'),
          });
          return;
        }
      } catch {
        // If availability check fails here, we still block submit to avoid confusion.
        setSubmitError(t('register.usernameCheckFailedSubmit'));
        return;
      }
    }

    try {
      await registerAccount({
        username: normalizedUsername,
        password: data.password,
        confirm_password: data.confirm_password,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim(),
        phone: stringToNull(data.phone),
        address: stringToNull(data.address),
        city: stringToNull(data.city),
        country: stringToNull(data.country),
        latitude: coordToNull(data.latitude),
        longitude: coordToNull(data.longitude),
        vat_number: stringToNull(data.vat_number),
        role: data.role,
      });
    } catch (err: unknown) {
      setSubmitError(mapRegisterError(err));
    }
  };

  const usernameHintColor =
    usernameStatus === 'available'
      ? 'text-emerald-700'
      : usernameStatus === 'taken'
        ? 'text-[var(--nexus-red)]'
        : 'text-neutral-600';

  return (
    <div className="bg-[var(--nexus-lightgray)]/40">
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            {t('register.title')}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">{t('register.subtitle')}</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          noValidate
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <fieldset className="md:col-span-2">
              <legend className="mb-1.5 block text-sm font-medium text-neutral-800">
                {t('register.accountType')} <span className="text-[var(--nexus-red)]">*</span>
              </legend>
              <p className="mb-2.5 text-sm text-neutral-600">{t('register.accountTypeHint')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: 'attendee',
                      title: t('register.attendee'),
                      hint: t('register.attendeeHint'),
                    },
                    {
                      value: 'organizer',
                      title: t('register.organizer'),
                      hint: t('register.organizerHint'),
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                      'hover:border-neutral-400',
                      roleValue === option.value
                        ? 'border-[var(--nexus-red)] bg-[var(--nexus-red)]/5'
                        : 'border-neutral-200 bg-white',
                    )}
                  >
                    <input
                      type="radio"
                      value={option.value}
                      className="mt-1 size-4 shrink-0 accent-[var(--nexus-red)]"
                      {...register('role')}
                    />
                    <span>
                      <span className="block text-sm font-medium text-neutral-900">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-neutral-600">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.role && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.role.message}</p>
              )}
            </fieldset>

            <div className="md:col-span-2">
              <label
                htmlFor="reg-username"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.username')} <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-username"
                type="text"
                autoComplete="username"
                className={cn(errors.username && 'border-red-500')}
                {...register('username')}
              />
              {(errors.username?.message || usernameHint) && (
                <p
                  className={cn(
                    'mt-1 text-sm',
                    errors.username ? 'text-[var(--nexus-red)]' : usernameHintColor,
                  )}
                >
                  {errors.username?.message ?? usernameHint}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-password"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.password')} <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                className={cn(errors.password && 'border-red-500')}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-confirm"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.confirmPassword')} <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                className={cn(errors.confirm_password && 'border-red-500')}
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-firstname"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.firstName')} <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-firstname"
                type="text"
                autoComplete="given-name"
                className={cn(errors.first_name && 'border-red-500')}
                {...register('first_name')}
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.first_name.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-lastname"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.lastName')} <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-lastname"
                type="text"
                autoComplete="family-name"
                className={cn(errors.last_name && 'border-red-500')}
                {...register('last_name')}
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.last_name.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="reg-email"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                Email <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                className={cn(errors.email && 'border-red-500')}
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-phone"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.phone')}
              </label>
              <Input id="reg-phone" type="tel" autoComplete="tel" {...register('phone')} />
            </div>

            <div>
              <label
                htmlFor="reg-vat"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.vat')}
              </label>
              <Input id="reg-vat" type="text" {...register('vat_number')} />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="reg-address"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.address')}
              </label>
              <Input
                id="reg-address"
                type="text"
                autoComplete="street-address"
                {...register('address')}
              />
            </div>

            <div>
              <label
                htmlFor="reg-city"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.city')}
              </label>
              <Input
                id="reg-city"
                type="text"
                autoComplete="address-level2"
                {...register('city')}
              />
            </div>

            <div>
              <label
                htmlFor="reg-country"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.country')}
              </label>
              <Input
                id="reg-country"
                type="text"
                autoComplete="country-name"
                {...register('country')}
              />
            </div>

            <div>
              <label
                htmlFor="reg-latitude"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.latitude')}
              </label>
              <Input
                id="reg-latitude"
                type="text"
                inputMode="decimal"
                placeholder={t('register.latPlaceholder')}
                {...register('latitude')}
              />
            </div>

            <div>
              <label
                htmlFor="reg-longitude"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                {t('register.longitude')}
              </label>
              <Input
                id="reg-longitude"
                type="text"
                inputMode="decimal"
                placeholder={t('register.lngPlaceholder')}
                {...register('longitude')}
              />
            </div>

            {mapPreviewCoords && (
              <div className="md:col-span-2 overflow-hidden rounded-lg border border-neutral-200">
                <EventMapEmbed
                  latitude={mapPreviewCoords.lat}
                  longitude={mapPreviewCoords.lon}
                  className="min-h-[220px] rounded-none"
                />
              </div>
            )}
          </div>

          {submitError && (
            <p
              className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]"
              role="alert"
            >
              {submitError}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || usernameStatus === 'checking'}
            className="mt-6 w-full bg-[var(--nexus-purple)] text-white hover:bg-[var(--nexus-purple-dark)]"
          >
            {isSubmitting ? t('register.submitting') : t('register.submit')}
          </Button>

          <p className="mt-6 text-center text-sm text-neutral-600">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="font-medium text-[var(--nexus-purple)] hover:underline">
              {t('register.login')}
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
