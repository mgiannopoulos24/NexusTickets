import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/langContextCore';

function makeSchema(t: (key: string) => string) {
  return z.object({
    username: z.string().min(1, t('login.usernameRequired')),
    password: z.string().min(1, t('login.passwordRequired')),
  });
}

type LoginForm = z.infer<ReturnType<typeof makeSchema>>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const { t } = useLang();
  const loginSchema = useMemo(() => makeSchema(t), [t]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    (user?.role === 'admin' ? '/admin/users' : '/');

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
      const msg = err instanceof Error ? err.message : t('login.error');
      setSubmitError(msg);
    }
  };

  return (
    <div className="bg-[var(--nexus-lightgray)]/40">
      <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">{t('login.title')}</h1>
          <p className="mt-2 text-sm text-neutral-600">{t('login.subtitle')}</p>
          {(location.state as { pendingApproval?: boolean } | null)?.pendingApproval && (
            <p className="mt-3 rounded-lg border border-[var(--nexus-purple)]/30 bg-[var(--nexus-purple)]/5 px-3 py-2 text-sm text-neutral-800">
              {t('login.pendingNotice')}
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
                {t('login.username')}
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
                {t('login.password')}
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
            className="mt-6 w-full bg-[var(--nexus-purple)] text-white hover:bg-[var(--nexus-purple-dark)]"
          >
            {t('login.submit')}
          </Button>

          <p className="mt-6 text-center text-sm text-neutral-600">
            {t('login.noAccount')}{' '}
            <Link to="/register" className="font-medium text-[var(--nexus-purple)] hover:underline">
              {t('login.register')}
            </Link>
          </p>
          <p className="mt-3 text-center text-sm text-neutral-600">
            <Link to="/" className="font-medium text-[var(--nexus-purple)] hover:underline">
              {t('login.backHome')}
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
