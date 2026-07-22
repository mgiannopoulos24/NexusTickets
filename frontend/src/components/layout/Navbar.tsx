import { Link } from 'react-router-dom';
import { Bell, ChevronDown, Menu } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { EVENTS_NAV_DROPDOWN_ITEMS } from '@/constants/navEventsDropdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navPrimaryClass =
  'flex shrink-0 cursor-pointer items-center self-stretch border-b-4 border-b-transparent px-3 outline-0 transition-colors hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)] hover:border-b-[var(--nexus-purple)]';

function userInitial(firstName: string, username: string): string {
  const c = firstName.trim().charAt(0) || username.trim().charAt(0);
  return c ? c.toLocaleUpperCase('el-GR') : '?';
}

export function Navbar() {
  const { user, accessToken, isHydrating, logout } = useAuth();
  const unreadCount = useAppSelector((s) => s.messaging.unreadCount);

  const handleLogout = async () => {
    await logout();
  };

  const showLoginButton = !user && !accessToken && !isHydrating;

  return (
    <header className="sticky top-0 z-50 border-b-0 bg-white/95 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 max-w-screen items-stretch justify-between gap-4 px-4 sm:px-6 lg:px-8">
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

        <div className="flex min-w-0 flex-1 items-stretch justify-end gap-2 sm:gap-3 lg:gap-4">
          <nav className="comfortaa-regular hidden items-stretch text-base text-neutral-800 lg:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(navPrimaryClass, 'items-center gap-0.5')}
                  aria-haspopup="menu"
                >
                  Εκδηλώσεις
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
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {user?.role === 'organizer' ? (
              <Link to="/organizer/events" className={cn(navPrimaryClass, 'items-center')}>
                Οι εκδηλώσεις μου
              </Link>
            ) : null}
            <Link to="/subscriptions" className={cn(navPrimaryClass, 'items-center')}>
              Συνδρομές
            </Link>
          </nav>

          <div className="flex shrink-0 items-stretch gap-1 sm:gap-2">
            <NavbarLanguageGlobe />
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="relative cursor-pointer self-center text-neutral-600"
              aria-label={
                unreadCount > 0 ? `Μηνύματα, ${unreadCount} μη αναγνωσμένα` : 'Μηνύματα'
              }
            >
              <Link to="/messages">
                <Bell className="size-5" />
                {unreadCount > 0 ? (
                  <Badge
                    variant="destructive"
                    className="absolute -right-0.5 -top-0.5 min-w-5 justify-center border-0 bg-[#6d28d9] px-1 text-[10px] text-white hover:bg-[#6d28d9]"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                ) : null}
              </Link>
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={selectFullAccountTriggerClassName()}
                    aria-label="Μενού λογαριασμού"
                  >
                    <span aria-hidden>{userInitial(user.first_name, user.username)}</span>
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
                        Ο λογαριασμός μου
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/bookings/me" className="flex w-full items-center">
                        Οι κρατήσεις μου
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/messages" className="flex w-full items-center">
                        Μηνύματα
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/favorites" className="flex w-full items-center">
                        Αγαπημένα
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={selectFullItemClassName()}>
                      <Link to="/settings" className="flex w-full items-center">
                        Ρυθμίσεις χρήστη
                      </Link>
                    </DropdownMenuItem>
                    {user.role === 'organizer' && (
                      <>
                        <DropdownMenuSeparator className={selectFullMenuSeparatorClass} />
                        <DropdownMenuItem asChild className={selectFullItemClassName()}>
                          <Link to="/organizer" className="flex w-full items-center">
                            Περιοχή διοργανωτή
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
                          <Link to="/admin" className="flex w-full items-center">
                            Admin panel
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
                      Αποσύνδεση
                    </DropdownMenuItem>
                  </SelectFullPanelContainer>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : accessToken && isHydrating ? (
              <span
                className="flex size-9 shrink-0 self-center rounded-full bg-neutral-200 animate-pulse"
                aria-hidden
              />
            ) : showLoginButton ? (
              <div className="hidden items-center gap-2 self-center sm:flex">
                <Button
                  asChild
                  variant="ghost"
                  className="cursor-pointer rounded-full comfortaa-regular"
                >
                  <Link to="/register">Εγγραφή</Link>
                </Button>
                <Button
                  asChild
                  className={cn(
                    'cursor-pointer rounded-full bg-[#6d28d9] px-5 text-white hover:bg-[#5b21b6] comfortaa-regular',
                  )}
                >
                  <Link to="/login">Σύνδεση</Link>
                </Button>
              </div>
            ) : null}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer self-center lg:hidden"
                  aria-label="Μενού"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0">
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
                      Εκδηλώσεις
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
                          {item.label}
                        </Link>
                      </SheetClose>
                    ))}
                    <SheetClose asChild>
                      <Link
                        to="/subscriptions"
                        className={cn(
                          'mt-2 rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                          'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                        )}
                      >
                        Συνδρομές
                      </Link>
                    </SheetClose>
                  </nav>

                  <div className="mt-4 border-t border-neutral-200 pt-4">
                    {user ? (
                      <div className="space-y-2">
                        <p className="text-sm text-neutral-600 comfortaa-regular">
                          Συνδεδεμένος ως{' '}
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
                              Ο λογαριασμός μου
                            </Link>
                          </SheetClose>
                          {user.role === 'organizer' && (
                            <SheetClose asChild>
                              <Link
                                to="/organizer"
                                className={cn(
                                  'rounded-xl px-3 py-2 text-base text-neutral-800 transition-colors comfortaa-regular',
                                  'hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)]',
                                )}
                              >
                                Περιοχή διοργανωτή
                              </Link>
                            </SheetClose>
                          )}
                          {user.role === 'admin' && (
                            <SheetClose asChild>
                              <Link
                                to="/admin"
                                className={cn(
                                  'rounded-xl px-3 py-2 text-base font-medium text-[var(--nexus-red)] transition-colors comfortaa-regular',
                                  'hover:bg-red-50',
                                )}
                              >
                                Admin panel
                              </Link>
                            </SheetClose>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            className="justify-start rounded-xl px-3 py-2 text-base text-neutral-800 comfortaa-regular"
                            onClick={() => void handleLogout()}
                          >
                            Αποσύνδεση
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
                            Εγγραφή
                          </Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link
                            to="/login"
                            className={cn(
                              'rounded-xl bg-[#6d28d9] px-3 py-2 text-base text-white transition hover:bg-[#5b21b6] comfortaa-regular',
                            )}
                          >
                            Σύνδεση
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
