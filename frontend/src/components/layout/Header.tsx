import { useEffect, useState } from 'react';

import { Search, User } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

export function Header({ className }: { className?: string }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky left-0 top-7 z-40 w-full border-b border-white/10 text-white',
        'bg-gradient-to-b from-[#0b5aa1] via-[#0a4f95] to-[#083f79]',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-6xl items-center gap-3 px-4 transition-all duration-300 ease-in-out',
          isScrolled ? 'h-11' : 'h-14',
        )}
      >
        <Link
          to="/"
          className="flex items-baseline gap-1 tracking-tight text-white"
          aria-label="NexusTickets"
        >
          <span className="comfortaa-semibold text-lg">NexusTickets</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Αναζήτηση"
          >
            <Search className="size-4" />
          </button>

          <Link
            to="/auth"
            className="comfortaa-semibold hidden items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:inline-flex"
          >
            <User className="size-4" />
            <span>Σύνδεση / Εγγραφή</span>
          </Link>

          <Link
            to="/auth"
            className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:hidden"
            aria-label="Σύνδεση / Εγγραφή"
          >
            <User className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

