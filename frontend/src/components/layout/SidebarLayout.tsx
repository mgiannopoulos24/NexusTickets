import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';

import { useLang } from '@/contexts/langContext';
import { cn } from '@/lib/utils';

export type SidebarLink = { label: string; to: string; icon: LucideIcon };

type SidebarLayoutProps = {
  /** Translation key of the area's title. */
  titleKey: string;
  /** Link labels are translation keys. */
  links: readonly SidebarLink[];
  /** The area's root path, matched exactly; deeper links match by prefix. */
  root: string;
  children: ReactNode;
};

/**
 * Shared shell for the admin and organizer areas. The sidebar is always on the
 * left and sticks under the navbar. On desktop it is a fixed column; on phones
 * it is a 56px icon rail, and the full menu opens as an overlay on top of the
 * content — the page itself never shifts.
 */
export function SidebarLayout({ titleKey, links, root, children }: SidebarLayoutProps) {
  const { t } = useLang();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (to: string) =>
    location.pathname === to || (to !== root && location.pathname.startsWith(`${to}/`));

  // Escape closes the overlay; a link click closes it explicitly below.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const itemClass = (active: boolean, withLabel: boolean) =>
    cn(
      'comfortaa-regular flex items-center gap-3 rounded-md text-base font-medium transition-colors',
      withLabel ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5',
      active
        ? 'bg-[var(--nexus-purple)] text-white'
        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
    );

  const fullMenu = (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <p className="comfortaa-bold truncate text-lg font-semibold text-neutral-800">
          {t(titleKey)}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('sidebar.collapse')}
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 md:hidden"
        >
          <PanelLeftClose className="size-5" />
        </button>
      </div>
      <nav className="flex flex-col gap-1 px-2 py-2">
        {links.map(({ label, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            aria-current={isActive(to) ? 'page' : undefined}
            className={itemClass(isActive(to), true)}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{t(label)}</span>
          </Link>
        ))}
      </nav>
    </>
  );

  return (
    <div className="relative flex min-h-screen w-full">
      {/* Desktop: a fixed column in the flow. */}
      <aside
        className="hidden w-[240px] shrink-0 border-r border-neutral-200 bg-white md:block"
        aria-label={t(titleKey)}
      >
        <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto">{fullMenu}</div>
      </aside>

      {/* Phone: the icon rail keeps its 56px; the menu opens on top of the page. */}
      <aside
        className="w-14 shrink-0 border-r border-neutral-200 bg-white md:hidden"
        aria-label={t(titleKey)}
      >
        <div className="sticky top-16 flex max-h-[calc(100vh-4rem)] flex-col overflow-y-auto px-1.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="sidebar-overlay"
            aria-label={t('sidebar.expand')}
            title={t('sidebar.expand')}
            className="my-2 flex justify-center rounded-md p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <PanelLeftOpen className="size-5" />
          </button>
          <nav className="flex flex-col gap-1 border-t border-neutral-200 py-2">
            {links.map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                aria-current={isActive(to) ? 'page' : undefined}
                title={t(label)}
                className={itemClass(isActive(to), false)}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="sr-only">{t(label)}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Always mounted so both opening and closing animate: the backdrop
          fades, the panel slides in from the left. */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 top-16 z-40 md:hidden',
          !open && 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label={t('sidebar.collapse')}
          onClick={() => setOpen(false)}
          className={cn(
            'absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out motion-reduce:transition-none',
            open ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          id="sidebar-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t(titleKey)}
          // @ts-expect-error `inert` is a valid attribute; React's typings lag behind.
          inert={open ? undefined : ''}
          className={cn(
            'absolute inset-y-0 left-0 w-[260px] max-w-[85vw] overflow-y-auto border-r border-neutral-200 bg-white shadow-xl',
            'transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {fullMenu}
        </div>
      </div>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
