import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLang } from '@/contexts/langContext';

export default function UnauthorizedPage() {
  const { t } = useLang();
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center bg-neutral-50/50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <ShieldAlert className="size-14 text-[var(--nexus-red)]" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-neutral-950 comfortaa-bold">
            {t('unauthorized.title')}
          </h1>
          <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
            {t('unauthorized.body')}
          </p>
          <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="w-full bg-[var(--nexus-purple)] text-white hover:bg-[var(--nexus-purple-dark)] sm:w-auto comfortaa-regular"
            >
              <Link to="/login">{t('unauthorized.login')}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto comfortaa-regular">
              <Link to="/">{t('unauthorized.home')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
