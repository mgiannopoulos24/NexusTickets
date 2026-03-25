import { Link } from 'react-router-dom';

import facebookIcon from '@/assets/icons/facebook.svg';
import instagramIcon from '@/assets/icons/instagram.svg';
import tiktokIcon from '@/assets/icons/tiktok.svg';
import youtubeIcon from '@/assets/icons/youtube.svg';
import linkedinIcon from '@/assets/icons/linkedin.svg';
import { cn } from '@/lib/utils';

type FooterLink = { label: string; to: string };

const INFO_LINKS: FooterLink[] = [
  { label: 'Αρχική', to: '/' },
  { label: 'Σύνδεση', to: '/login' },
  { label: 'Εγγραφή', to: '/register' },
] as const;

const SUPPORT_LINKS: FooterLink[] = [
  { label: 'Κατάσταση εγγραφής', to: '/register/pending' },
  { label: 'Πίνακας διαχείρισης', to: '/admin' },
] as const;

const SOCIALS = [
  { label: 'Facebook', href: 'https://www.facebook.com', icon: facebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com', icon: instagramIcon },
  { label: 'TikTok', href: 'https://www.tiktok.com', icon: tiktokIcon },
  { label: 'YouTube', href: 'https://www.youtube.com', icon: youtubeIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', icon: linkedinIcon },
] as const;

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-800 comfortaa-bold">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className={cn(
                'text-sm text-neutral-500 transition-colors comfortaa-regular',
                'hover:text-neutral-900 hover:underline underline-offset-4',
              )}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_1fr_1.2fr] md:gap-12">
          <div className="order-1 md:order-3">
            <Link to="/" className="inline-flex items-baseline">
              <span className="text-xl comfortaa-bold tracking-tight text-[var(--nexus-purple)]">
                Nexus
              </span>
              <span className="text-xl comfortaa-semibold tracking-tight text-[var(--nexus-purple)]/90">
                Tickets
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-neutral-500 comfortaa-regular">
              Ανακάλυψε εκδηλώσεις και κράτησε εισιτήρια εύκολα, γρήγορα και με ασφάλεια.
            </p>
          </div>

          <div className="order-2 md:order-1">
            <FooterColumn title="Πληροφορίες" links={INFO_LINKS} />
          </div>

          <div className="order-3 md:order-2">
            <FooterColumn title="Υποστήριξη" links={SUPPORT_LINKS} />
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm font-semibold text-neutral-800 comfortaa-bold">Stay Connected</p>
          <div className="mt-3 flex items-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={s.label}
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-full border border-neutral-200',
                  'bg-white text-neutral-700 transition-colors',
                  'hover:bg-neutral-50 hover:text-neutral-900',
                )}
              >
                <img src={s.icon} alt="" aria-hidden className="size-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-200 pt-6">
          <p className="text-center text-xs text-neutral-500 comfortaa-regular">© {new Date().getFullYear()} NexusTickets</p>
        </div>
      </div>
    </footer>
  );
}

