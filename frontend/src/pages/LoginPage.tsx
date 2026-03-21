import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAuth } from '@/contexts/AuthContent';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  username: z.string().min(1, 'Εισάγετε όνομα χρήστη'),
  password: z.string().min(1, 'Εισάγετε κωδικό'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, from, navigate]);

  const onSubmit = async (data: LoginForm) => {
    setSubmitError(null);
    try {
      await login(data.username.trim(), data.password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Προέκυψε σφάλμα. Δοκιμάστε ξανά.';
      setSubmitError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--nexus-lightgray)]/40">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">Σύνδεση</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Συνδεθείτε για να συνεχίσετε στο NexusTickets.
          </p>
          {(location.state as { pendingApproval?: boolean } | null)?.pendingApproval && (
            <p className="mt-3 rounded-lg border border-[#6d28d9]/30 bg-[#6d28d9]/5 px-3 py-2 text-sm text-neutral-800">
              Η εγγραφή ελήφθη. Η ενεργοποίηση του λογαριασμού σας εκκρεμεί έγκριση από διαχειριστή.
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          noValidate
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                Όνομα χρήστη
              </label>
              <Input
                id="login-username"
                type="text"
                autoComplete="username"
                className={cn(errors.username && 'border-red-500')}
                {...register('username')}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.username.message}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-neutral-800"
              >
                Κωδικός
              </label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className={cn(errors.password && 'border-red-500')}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-[var(--nexus-red)]">{errors.password.message}</p>
              )}
            </div>
          </div>

          {submitError && (
            <p
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]"
              role="alert"
            >
              {submitError}
            </p>
          )}

          <Button
            type="submit"
            className="mt-6 w-full rounded-full bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
          >
            Σύνδεση
          </Button>

          <p className="mt-6 text-center text-sm text-neutral-600">
            <Link to="/" className="font-medium text-[#6d28d9] hover:underline">
              Επιστροφή στην αρχική
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
