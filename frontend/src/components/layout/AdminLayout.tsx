import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

type AdminLayoutProps = {
  children: ReactNode;
};

const ADMIN_LINKS = [
  { label: 'Επισκόπηση', to: '/admin' },
  { label: 'Εκδηλώσεις', to: '/admin/events' },
] as const;

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="w-[260px] shrink-0 border-r border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-4">
          <p className="text-lg font-semibold text-neutral-800 comfortaa-bold">Admin</p>
        </div>
        <nav className="flex flex-col gap-1 px-2 py-2">
          {ADMIN_LINKS.map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'px-3 py-2.5 text-base font-medium transition-colors comfortaa-regular',
                  active
                    ? 'bg-[var(--nexus-purple)] text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
