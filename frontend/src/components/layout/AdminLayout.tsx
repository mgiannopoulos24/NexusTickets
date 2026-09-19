import type { ReactNode } from 'react';
import { CalendarDays, LayoutDashboard, LifeBuoy, Users } from 'lucide-react';

import { useGetSupportCountsQuery } from '@/app/supportApi';
import { SidebarLayout, type SidebarLink } from '@/components/layout/SidebarLayout';

export function AdminLayout({ children }: { children: ReactNode }) {
  // Open tickets waiting on the administration, shown as a badge on the
  // Support link. The layout only renders inside admin-guarded routes, and
  // the WS subscription keeps the counts fresh via the shared Support tags.
  const { data: counts } = useGetSupportCountsQuery();
  const openTickets = counts?.open ?? 0;

  const adminLinks: readonly SidebarLink[] = [
    { label: 'adminNav.overview', to: '/admin', icon: LayoutDashboard },
    { label: 'adminNav.users', to: '/admin/users', icon: Users },
    { label: 'adminNav.events', to: '/admin/events', icon: CalendarDays },
    {
      label: 'adminNav.requests',
      to: '/admin/support',
      icon: LifeBuoy,
      badge: openTickets > 0 ? openTickets : undefined,
    },
  ];

  return (
    <SidebarLayout titleKey="adminNav.title" links={adminLinks} root="/admin">
      {children}
    </SidebarLayout>
  );
}
