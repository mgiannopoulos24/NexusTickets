import type { ReactNode } from 'react';
import { CalendarDays, LayoutDashboard, LifeBuoy, Users } from 'lucide-react';

import { SidebarLayout, type SidebarLink } from '@/components/layout/SidebarLayout';

const ADMIN_LINKS: readonly SidebarLink[] = [
  { label: 'adminNav.overview', to: '/admin', icon: LayoutDashboard },
  { label: 'adminNav.users', to: '/admin/users', icon: Users },
  { label: 'adminNav.events', to: '/admin/events', icon: CalendarDays },
  { label: 'adminNav.requests', to: '/admin/support', icon: LifeBuoy },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarLayout titleKey="adminNav.title" links={ADMIN_LINKS} root="/admin">
      {children}
    </SidebarLayout>
  );
}
