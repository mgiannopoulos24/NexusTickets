import { Link } from 'react-router-dom';
import { ChevronDown, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NavbarLanguageGlobe } from '@/components/layout/NavbarLanguageGlobe';
import {
  SelectFullPanelContainer,
  selectFullAccountTriggerClassName,
  selectFullItemClassName,
  selectFullMenuSeparatorClass,
} from '@/components/ui/select-full';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAppSelector } from '@/app/hooks';
import { useGetSupportCountsQuery } from '@/app/supportApi';
import { Badge } from '@/components/ui/badge';
import { EVENTS_NAV_DROPDOWN_ITEMS } from '@/constants/navEventsDropdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLang } from '@/contexts/langContextCore';

const navPrimaryClass =
  'flex shrink-0 cursor-pointer items-center self-stretch border-b-4 border-b-transparent px-3 outline-0 transition-colors hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)] hover:border-b-[var(--nexus-purple)]';

function userInitial(firstName: string, username: string): string {
  const c = firstName.trim().charAt(0) || username.trim().charAt(0);
  return c ? c.toLocaleUpperCase('el-GR') : '?';
}

export function Navbar() {
  const { user, accessToken, isHydrating, logout } = useAuth();
  const { t } = useLang();
  const unreadCount = useAppSelector((s) => s.messaging.unreadCount);
  // Open support requests drive the badge on the admin links. The counts
  // endpoint is admin-only, so it is skipped for everyone else.
  const { data: supportCounts } = useGetSupportCountsQuery(undefined, {
    skip: user?.role !== 'admin',
  });
  const openTickets = user?.role === 'admin' ? (supportCounts?.open ?? 0) : 0;

  const handleLogout = async () => {
    await logout();
  };

  const showLoginButton = !user && !accessToken && !isHydrating;

  return (
    <header className="sticky top-0 z-50 border-b-0 bg-white/95 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-[1400px] items-stretch justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center">
          <Link to="/" className="flex cursor-pointer items-baseline">
            <span className="text-base sm:text-lg md:text-xl lg:text-2xl comfortaa-bold tracking-tight text-[var(--nexus-purple)]">
              Nexus
            </span>
            <span className="text-base sm:text-lg md:text-xl lg:text-2xl comfortaa-semibold tracking-tight text-[var(--nexus-purple)]/90">
              Tickets
            </span>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-stretch justify-end">
          <nav className="comfortaa-regular hidden items-stretch text-base text-neutral-800 lg:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(navPrimaryClass, 'items-center gap-0.5')}
                  aria-haspopup="menu"
                >
                  {t('nav.events')}
                  <ChevronDown className="size-4 opacity-70" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="min-w-[260px] p-1">
                {EVENTS_NAV_DROPDOWN_ITEMS.map((item) => (
                  <DropdownMenuItem key={item.label} asChild>
                    <Link
                      to={item.to}
                      className="cursor-pointer rounded-md px-3 py-2.5 text-sm text-neutral-900 comfortaa-regular"
                    >
                      {t(item.label)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {user?.role === 'organizer' || user?.role === 'admin' ? (
              <Link to="/organizer/events" className={cn(navPrimaryClass, 'items-center')}>
                {t('nav.myEvents')}
              </Link>
            ) : null}
          </nav>

          {/* Same rhythm as the nav items (px-3, full-height hover); the
              account actions sit after a hairline divider. */}
          <div className="flex shrink-0 items-stretch">
            <NavbarLanguageGlobe />
            <span className="my-4 hidden w-px bg-neutral-200 sm:block" aria-hidden />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(selectFullAccountTriggerClassName(), 'relative ml-3')}
                    aria-label={
                      unreadCount > 0
                        ? t('nav.accountMenuUnread', { count: unreadCount })
                        : t('nav.accountMenu')
                    }
                  >
                    <span aria-hidden>{userInitial(user.first_name, user.username)}</span>
                    {/* The "new message" indicator of assignment §10: it sits on
                        the profile icon, where the messages live. */}
                    {unreadCount > 0 ? (
                      <Badge
                        variant="destructive"
                        className="absolute -right-1 -top-1 min-w-5 justify-center border-0 bg-[var(--nexus-purple)] px-1 text-[10px] text-white hover:bg-[var(--nexus-purple)]"
                        aria-hidden
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    ) : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={20}
                  className="min-w-[280px] border-0 bg-transparent p-0 !shadow-none ring-0"
                >
                  <SelectFullPanelContainer>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/account" className="flex w-full items-center">
                        {t('nav.myAccount')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/bookings/me" className="flex w-full items-center">
                        {t('nav.myBookings')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/messages" className="flex w-full items-center justify-between">
                        <span>{t('nav.messages')}</span>
                        {unreadCount > 0 ? (
                          <span className="rounded-full bg-[var(--nexus-purple)] px-2 py-0.5 text-[11px] font-semibold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        ) : null}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/support" className="flex w-full items-center">
                        {t('nav.support')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/settings" className="flex w-full items-center">
                        {t('nav.settings')}
                      </Link>
                    </DropdownMenuItem>
                    {(user.role === 'organizer' || user.role === 'admin') && (
                      <>
                        <DropdownMenuSeparator className={selectFullMenuSeparatorClass} />
                        <DropdownMenuItem asChild className={selectFullItemClassName()}>
                          <Link to="/organizer" className="flex w-full items-center">
                            {t('nav.organizerArea')}
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {user.role === 'admin' && (
                      <>
                        <DropdownMenuSeparator className={selectFullMenuSeparatorClass} />
                        <DropdownMenuItem
                          asChild
                          className={selectFullItemClassName(
                            'font-medium text-[var(--nexus-red)] focus:text-[var(--nexus-red)] data-[highlighted]:text-[var(--nexus-red)]',
                          )}
                        >
                          <Link to="/admin" className="flex w-full items-center justify-between">
                            <span>{t('nav.adminPanel')}</span>
                            {openTickets > 0 ? (
                              <span className="rounded-full bg-[var(--nexus-red)] px-2 py-0.5 text-[11px] font-semibold text-white">
                                {openTickets > 99 ? '99+' : openTickets}
                              </span>
                            ) : null}
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className={selectFullMenuSeparatorClass} />
                    <DropdownMenuItem
                      className={selectFullItemClassName('text-neutral-800 focus:text-neutral-900')}
                      onSelect={(e) => {
                        e.preventDefault();
                        void handleLogout();
                      }}
                    >
                      {t('nav.logout')}
                    </DropdownMenuItem>
                  </SelectFullPanelContainer>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : accessToken && isHydrating ? (
              <span
                className="ml-3 flex size-9 shrink-0 self-center rounded-full bg-neutral-200 animate-pulse"
                aria-hidden
              />
            ) : showLoginButton ? (
              <div className="hidden items-center gap-2 self-center pl-3 sm:flex">
                <Button asChild variant="ghost" className="cursor-pointer comfortaa-regular">
                  <Link to="/register">{t('nav.register')}</Link>
                </Button>
                <Button
                  asChild
                  className={cn(
                    'cursor-pointer bg-[var(--nexus-purple)] px-5 text-white hover:bg-[var(--nexus-purple-dark)] comfortaa-regular',
                  )}
                >
                  <Link to="/login">{t('nav.login')}</Link>
                </Button>
              </div>
            ) : null}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-1 cursor-pointer self-center lg:hidden"
                  aria-label={t('nav.menu')}
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="overflow-y-auto p-0">
                <SheetHeader className="border-b border-neutral-200">
                  <SheetTitle className="comfortaa-bold">
                    <Link to="/" className="inline-flex items-baseline">
                      <span className="text-lg comfortaa-bold tracking-tight text-[var(--nexus-purple)]">
                        Nexus
                      </span>
                      <span className="text-lg comfortaa-semibold tracking-tight text-[var(--nexus-purple)]/90">
                        Tickets
                      </span>
                    </Link>
                  </SheetTitle>
                </SheetHeader>

                <div className="p-4">
                  <nav className="flex flex-col gap-1">
                    <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 comfortaa-regular">
                      {t('nav.events')}
                    </p>
                    {EVENTS_NAV_DROPDOWN_ITEMS.map((item) => (
                      <SheetClose asChild key={item.label}>
                        <Link
                          to={item.to}
                          className={cn(
                            'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                            'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                          )}
                        >
                          {t(item.label)}
                        </Link>
                      </SheetClose>
                    ))}
                    {user?.role === 'organizer' || user?.role === 'admin' ? (
                      <SheetClose asChild>
                        <Link
                          to="/organizer/events"
                          className={cn(
                            'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                            'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                          )}
                        >
                          {t('nav.myEvents')}
                        </Link>
                      </SheetClose>
                    ) : null}
                  </nav>

                  <div className="mt-4 border-t border-neutral-200 pt-4">
                    {user ? (
                      <div className="space-y-2">
                        <p className="text-sm text-neutral-600 comfortaa-regular">
                          {t('nav.signedInAs')}{' '}
                          <span className="font-semibold text-neutral-900">{user.username}</span>
                        </p>
                        <div className="flex flex-col gap-2">
                          <SheetClose asChild>
                            <Link
                              to="/account"
                              className={cn(
                                'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                                'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                              )}
                            >
                              {t('nav.myAccount')}
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              to="/bookings/me"
                              className={cn(
                                'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                                'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                              )}
                            >
                              {t('nav.myBookings')}
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              to="/messages"
                              className={cn(
                                'flex items-center justify-between rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                                'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                              )}
                            >
                              <span>{t('nav.messages')}</span>
                              {unreadCount > 0 ? (
                                <span className="rounded-full bg-[var(--nexus-purple)] px-2 py-0.5 text-[11px] font-semibold text-white">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              ) : null}
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              to="/support"
                              className={cn(
                                'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                                'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                              )}
                            >
                              {t('nav.support')}
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              to="/settings"
                              className={cn(
                                'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                                'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                              )}
                            >
                              {t('nav.settings')}
                            </Link>
                          </SheetClose>
                          {(user.role === 'organizer' || user.role === 'admin') && (
                            <SheetClose asChild>
                              <Link
                                to="/organizer"
                                className={cn(
                                  'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                                  'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                                )}
                              >
                                {t('nav.organizerArea')}
                              </Link>
                            </SheetClose>
                          )}
                          {user.role === 'admin' && (
                            <SheetClose asChild>
                              <Link
                                to="/admin"
                                className={cn(
                                  'flex items-center justify-between rounded-xl px-3 py-2 text-base font-medium text-[var(--nexus-red)] transition-colors comfortaa-regular',
                                  'hover:bg-red-50',
                                )}
                              >
                                <span>{t('nav.adminPanel')}</span>
                                {openTickets > 0 ? (
                                  <span className="rounded-full bg-[var(--nexus-red)] px-2 py-0.5 text-[11px] font-semibold text-white">
                                    {openTickets > 99 ? '99+' : openTickets}
                                  </span>
                                ) : null}
                              </Link>
                            </SheetClose>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            className="justify-start rounded-xl px-3 py-2 text-base text-neutral-800 comfortaa-regular"
                            onClick={() => void handleLogout()}
                          >
                            {t('nav.logout')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <SheetClose asChild>
                          <Link
                            to="/register"
                            className={cn(
                              'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                              'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                            )}
                          >
                            {t('nav.register')}
                          </Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link
                            to="/login"
                            className={cn(
                              'rounded-xl bg-[var(--nexus-purple)] px-3 py-2 text-base text-white transition hover:bg-[var(--nexus-purple-dark)] comfortaa-regular',
                            )}
                          >
                            {t('nav.login')}
                          </Link>
                        </SheetClose>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
