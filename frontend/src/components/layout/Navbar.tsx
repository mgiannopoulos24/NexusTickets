import { Link } from 'react-router-dom';
import { Bell, ChevronDown, Search } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContent';

const NAV_LINKS = [
  { label: 'Εκδηλώσεις', href: '/events' },
  { label: 'Θέατρο', href: '/events?category=theater' },
  { label: 'Μουσική', href: '/events?category=music' },
  { label: 'Αθλητικά', href: '/events?category=sports' },
  { label: 'Σινεμά', href: '/events?category=cinema' },
  { label: 'Συνδρομές', href: '/subscriptions' },
] as const;

function userInitial(firstName: string, username: string): string {
  const c = firstName.trim().charAt(0) || username.trim().charAt(0);
  return c ? c.toLocaleUpperCase('el-GR') : '?';
}

export function Navbar() {
  const { user, accessToken, isHydrating, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const showLoginButton = !user && !accessToken && !isHydrating;

  return (
    <header className="sticky top-0 z-50 border-b-0 bg-white/95 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 max-w-screen items-stretch justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center">
          <Link to="/" className="flex cursor-pointer items-baseline">
            <span className="text-xl comfortaa-bold tracking-tight text-[var(--nexus-purple)] sm:text-2xl">
              Nexus
            </span>
            <span className="text-xl comfortaa-semibold tracking-tight text-[var(--nexus-purple)]/90 sm:text-2xl">
              Tickets
            </span>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-stretch justify-end gap-2 sm:gap-3 lg:gap-4">
          <nav className="comfortaa-regular hidden items-stretch text-base text-neutral-800 lg:flex">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="flex shrink-0 cursor-pointer self-stretch items-center border-b-4 border-b-transparent px-3 outline-0 transition-colors hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)] hover:border-b-[var(--nexus-purple)]"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className="flex shrink-0 cursor-pointer self-stretch items-center gap-0.5 border-b-4 border-b-transparent px-3 outline-0 transition-colors hover:bg-[var(--nexus-lightgray)] hover:text-[var(--nexus-purple)] hover:border-b-[var(--nexus-purple)]"
            >
              Περισσότερα
              <ChevronDown className="size-4 opacity-70" aria-hidden />
            </button>
          </nav>

          <div className="flex shrink-0 items-stretch gap-1 sm:gap-2">
            <NavbarLanguageGlobe />
            <Button
              variant="ghost"
              size="icon"
              className="relative cursor-pointer self-center text-neutral-600"
              aria-label="Ειδοποιήσεις"
            >
              <Bell className="size-5" />
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[#6d28d9] text-[10px] font-semibold text-white">
                1
              </span>
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
                      <Link to="/orders" className="flex w-full items-center">
                        Παραγγελίες
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
              <Button
                asChild
                className={cn(
                  'hidden cursor-pointer self-center rounded-full bg-[#6d28d9] px-5 text-white hover:bg-[#5b21b6] sm:inline-flex',
                )}
              >
                <Link to="/login">Σύνδεση</Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer self-center lg:hidden"
              aria-label="Αναζήτηση"
            >
              <Search className="size-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
