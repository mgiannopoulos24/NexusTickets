import { Search, User } from 'lucide-react';

import { cn } from '@/lib/utils';

type HeaderLink = {
  label: string;
  href: string;
};

const primaryLinks: HeaderLink[] = [
  { label: 'Αθλητικά', href: '/sports' },
  { label: 'Θέατρο', href: '/theatre' },
  { label: 'Μουσική', href: '/music' },
  { label: 'Σινεμά', href: '/cinema' },
  { label: 'Χορός', href: '/dance' },
  { label: 'Residency', href: '/residency' },
  { label: 'Μουσεία', href: '/museums' },
  { label: 'Λοιπά Θέματα', href: '/other' },
];

export function Header({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-white/10 bg-gradient-to-b from-[#0b5aa1] via-[#0a4f95] to-[#083f79] text-white',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <a
          href="/"
          className="flex items-baseline gap-1 tracking-tight text-white"
          aria-label="NexusTickets"
        >
          <span className="comfortaa-semibold text-lg italic">ticket</span>
          <span className="comfortaa-bold text-lg italic">master</span>
        </a>

        <nav className="comfortaa-medium hidden flex-1 items-center justify-center gap-5 text-[13px] text-white/90 lg:flex">
          {primaryLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-1.5 py-1 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Αναζήτηση"
          >
            <Search className="size-4" />
          </button>

          <a
            href="/auth"
            className="comfortaa-semibold hidden items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:inline-flex"
          >
            <User className="size-4" />
            <span>Σύνδεση / Εγγραφή</span>
          </a>

          <a
            href="/auth"
            className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:hidden"
            aria-label="Σύνδεση / Εγγραφή"
          >
            <User className="size-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
