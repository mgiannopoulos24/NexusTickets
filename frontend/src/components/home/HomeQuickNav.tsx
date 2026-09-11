import { Link } from 'react-router-dom';
import { CalendarCog, Search } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useLang } from '@/contexts/langContext';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/enums';

function manageHrefFor(role: UserRole): string | null {
  switch (role) {
    case 'organizer':
      return '/organizer/events';
    case 'admin':
      return '/admin/events';
    case 'attendee':
      return '/bookings/me';
    default:
      return null;
  }
}

function manageLabelKey(role: UserRole): string {
  return role === 'attendee' ? 'home.quickNav.myBookings' : 'home.quickNav.manage';
}

export function HomeQuickNav() {
  const { user } = useAuth();
  const { t } = useLang();

  if (!user) return null;

  const manageHref = manageHrefFor(user.role);
  if (!manageHref) return null;

  const primaryClass = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3',
    'bg-[var(--nexus-purple)] text-sm text-white shadow-sm transition comfortaa-regular',
    'hover:bg-[var(--nexus-purple-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexus-purple)]/40',
  );
  const secondaryClass = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3',
    'border border-neutral-200 bg-white text-sm text-neutral-900 shadow-sm transition comfortaa-regular',
    'hover:border-[var(--nexus-purple)] hover:text-[var(--nexus-purple)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexus-purple)]/40',
  );

  return (
    <section
      aria-label={t('home.quickNav.ariaLabel')}
      className="border-b border-neutral-100 bg-white"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col items-stretch gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-center sm:gap-4 sm:px-6 lg:px-8">
        <Link to={manageHref} className={primaryClass}>
          <CalendarCog className="size-4" aria-hidden />
          {t(manageLabelKey(user.role))}
        </Link>
        <Link to="/events" className={secondaryClass}>
          <Search className="size-4" aria-hidden />
          {t('home.quickNav.browse')}
        </Link>
      </div>
    </section>
  );
}

export default HomeQuickNav;
