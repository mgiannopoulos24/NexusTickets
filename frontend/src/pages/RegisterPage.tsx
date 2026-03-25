import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContent';
import { cn } from '@/lib/utils';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

function stringToNull(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

const registerSchema = z
  .object({
    username: z.string().trim().min(3, 'Το όνομα χρήστη πρέπει να έχει τουλάχιστον 3 χαρακτήρες'),
    password: z.string().min(8, 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες'),
    confirm_password: z.string().min(1, 'Επιβεβαιώστε τον κωδικό'),
    first_name: z.string().trim().min(1, 'Εισάγετε όνομα'),
    last_name: z.string().trim().min(1, 'Εισάγετε επώνυμο'),
    email: z.string().trim().email('Εισάγετε έγκυρο email'),
    phone: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    vat_number: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: 'Οι κωδικοί δεν ταιριάζουν',
    path: ['confirm_password'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

function mapRegisterError(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('username already taken')) return 'Το όνομα χρήστη χρησιμοποιείται ήδη.';
  if (msg.includes('email already taken')) return 'Το email χρησιμοποιείται ήδη.';
  if (msg.includes('missing required registration fields')) return 'Συμπληρώστε όλα τα υποχρεωτικά πεδία.';
  return 'Προέκυψε σφάλμα. Δοκιμάστε ξανά.';
}

async function checkUsernameAvailable(username: string): Promise<boolean> {
  const res = await fetch(
    `/api/v1/auth/username-available?username=${encodeURIComponent(username.trim())}`,
  );
  const json = (await res.json()) as ApiEnvelope<{ available: boolean }>;
  if (!res.ok || json.error || !json.data) {
    throw new Error(json.error?.message ?? 'Σφάλμα ελέγχου ονόματος χρήστη');
  }
  return json.data.available;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount, user } = useAuth();
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
      vat_number: '',
    },
  });

  const usernameValue = watch('username');

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
          setUsernameHint(available ? 'Διαθέσιμο όνομα χρήστη' : 'Το όνομα χρήστη χρησιμοποιείται ήδη');
          if (!available) {
            setError('username', { type: 'validate', message: 'Το όνομα χρήστη χρησιμοποιείται ήδη' });
          } else {
            clearErrors('username');
          }
        })
        .catch(() => {
          setUsernameStatus('error');
          setUsernameHint('Δεν ήταν δυνατός ο έλεγχος διαθεσιμότητας');
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
          setUsernameHint('Το όνομα χρήστη χρησιμοποιείται ήδη');
          setError('username', { type: 'validate', message: 'Το όνομα χρήστη χρησιμοποιείται ήδη' });
          return;
        }
      } catch {
        // If availability check fails here, we still block submit to avoid confusion.
        setSubmitError('Δεν ήταν δυνατός ο έλεγχος διαθεσιμότητας ονόματος χρήστη.');
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
        vat_number: stringToNull(data.vat_number),
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
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">Εγγραφή</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Δημιουργήστε λογαριασμό για να κάνετε κρατήσεις και να διαχειρίζεστε τις επιλογές σας.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          noValidate
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="reg-username" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Όνομα χρήστη <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-username"
                type="text"
                autoComplete="username"
                className={cn(errors.username && 'border-red-500')}
                {...register('username')}
              />
              {(errors.username?.message || usernameHint) && (
                <p className={cn('mt-1 text-sm', errors.username ? 'text-[var(--nexus-red)]' : usernameHintColor)}>
                  {errors.username?.message ?? usernameHint}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Κωδικός <span className="text-[var(--nexus-red)]">*</span>
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
              <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Επιβεβαίωση κωδικού <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                className={cn(errors.confirm_password && 'border-red-500')}
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.confirm_password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="reg-firstname" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Όνομα <span className="text-[var(--nexus-red)]">*</span>
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
              <label htmlFor="reg-lastname" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Επώνυμο <span className="text-[var(--nexus-red)]">*</span>
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
              <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Email <span className="text-[var(--nexus-red)]">*</span>
              </label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                className={cn(errors.email && 'border-red-500')}
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Τηλέφωνο
              </label>
              <Input id="reg-phone" type="tel" autoComplete="tel" {...register('phone')} />
            </div>

            <div>
              <label htmlFor="reg-vat" className="mb-1.5 block text-sm font-medium text-neutral-800">
                ΑΦΜ
              </label>
              <Input id="reg-vat" type="text" {...register('vat_number')} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="reg-address" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Διεύθυνση
              </label>
              <Input id="reg-address" type="text" autoComplete="street-address" {...register('address')} />
            </div>

            <div>
              <label htmlFor="reg-city" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Πόλη
              </label>
              <Input id="reg-city" type="text" autoComplete="address-level2" {...register('city')} />
            </div>

            <div>
              <label htmlFor="reg-country" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Χώρα
              </label>
              <Input id="reg-country" type="text" autoComplete="country-name" {...register('country')} />
            </div>
          </div>

          {submitError && (
            <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]" role="alert">
              {submitError}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || usernameStatus === 'checking'}
            className="mt-6 w-full rounded-full bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
          >
            {isSubmitting ? 'Υποβολή…' : 'Εγγραφή'}
          </Button>

          <p className="mt-6 text-center text-sm text-neutral-600">
            Έχετε ήδη λογαριασμό;{' '}
            <Link to="/login" className="font-medium text-[#6d28d9] hover:underline">
              Σύνδεση
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

