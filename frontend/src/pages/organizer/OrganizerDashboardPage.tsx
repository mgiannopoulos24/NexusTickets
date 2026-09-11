import { Link } from 'react-router-dom';

import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import { Button } from '@/components/ui/button';
import { useLang } from '@/contexts/langContext';

export default function OrganizerDashboardPage() {
  const { t } = useLang();
  return (
    <OrganizerLayout>
      <div className="bg-white p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">
          {t('organizerDash.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-neutral-600 comfortaa-regular">
          {t('organizerDash.intro')}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            asChild
            className="rounded-none border-2 border-[var(--nexus-purple)] bg-[var(--nexus-purple)] px-4 py-2 text-white hover:bg-[var(--nexus-purple-dark)] comfortaa-regular"
          >
            <Link to="/organizer/events/new">{t('organizerDash.newEvent')}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-none border-2 border-neutral-300 bg-transparent px-4 py-2 comfortaa-regular"
          >
            <Link to="/organizer/events">{t('organizerDash.myEvents')}</Link>
          </Button>
        </div>
      </div>
    </OrganizerLayout>
  );
}
