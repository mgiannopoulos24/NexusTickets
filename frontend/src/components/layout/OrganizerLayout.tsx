import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

type OrganizerLayoutProps = {
  children: ReactNode;
};

const ORGANIZER_LINKS = [
  { label: 'Επισκόπηση', to: '/organizer' },
  { label: 'Οι εκδηλώσεις μου', to: '/organizer/events' },
  { label: 'Νέα εκδήλωση', to: '/organizer/events/new' },
] as const;

function isOrganizerNavActive(pathname: string, linkTo: string): boolean {
  if (linkTo === '/organizer') return pathname === '/organizer';
  if (linkTo === '/organizer/events/new') return pathname === '/organizer/events/new';
  if (linkTo === '/organizer/events') {
    if (pathname === '/organizer/events/new') return false;
    return pathname === '/organizer/events' || /^\/organizer\/events\/[^/]+\/edit$/.test(pathname);
  }
  return pathname === linkTo || pathname.startsWith(`${linkTo}/`);
}

export function OrganizerLayout({ children }: OrganizerLayoutProps) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="w-[260px] shrink-0 border-r border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-4">
          <p className="text-lg font-semibold text-neutral-800 comfortaa-bold">Διοργανωτής</p>
        </div>
        <nav className="flex flex-col gap-1 px-2 py-2">
          {ORGANIZER_LINKS.map((l) => {
            const active = isOrganizerNavActive(location.pathname, l.to);
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
