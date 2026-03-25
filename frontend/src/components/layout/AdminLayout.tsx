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
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
      <aside className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">Admin</p>
        <nav className="mt-3 flex flex-col gap-1">
          {ADMIN_LINKS.map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm transition-colors comfortaa-regular',
                  active
                    ? 'bg-violet-50 text-[var(--nexus-purple)]'
                    : 'text-neutral-700 hover:bg-[var(--nexus-lightgray)] hover:text-neutral-900',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
