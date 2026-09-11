import type { ReactNode } from 'react';
import { CalendarDays, LayoutDashboard, Plus } from 'lucide-react';

import { SidebarLayout, type SidebarLink } from '@/components/layout/SidebarLayout';

const ORGANIZER_LINKS: readonly SidebarLink[] = [
  { label: 'organizerNav.overview', to: '/organizer', icon: LayoutDashboard },
  { label: 'organizerNav.myEvents', to: '/organizer/events', icon: CalendarDays },
  { label: 'organizerNav.newEvent', to: '/organizer/events/new', icon: Plus },
];

export function OrganizerLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarLayout titleKey="organizerNav.title" links={ORGANIZER_LINKS} root="/organizer">
      {children}
    </SidebarLayout>
  );
}
