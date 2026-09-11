import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useLang } from '@/contexts/langContext';

export default function PendingApprovalPage() {
  const { t } = useLang();
  return (
    <div className="bg-[var(--nexus-lightgray)]/40">
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 comfortaa-bold">
            {t('pending.title')}
          </h1>
          <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
            {t('pending.body1')} <span className="font-medium">{t('pending.statusWord')}</span>{' '}
            {t('pending.body2')}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-700 comfortaa-regular">{t('pending.body3')}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="w-full bg-[var(--nexus-purple)] text-white hover:bg-[var(--nexus-purple-dark)] sm:w-auto comfortaa-regular"
            >
              <Link to="/login">{t('pending.goToLogin')}</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full sm:w-auto comfortaa-regular">
              <Link to="/">{t('pending.backHome')}</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
