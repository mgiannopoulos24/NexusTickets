import { Link } from 'react-router-dom';

import facebookIcon from '@/assets/icons/facebook.svg';
import instagramIcon from '@/assets/icons/instagram.svg';
import tiktokIcon from '@/assets/icons/tiktok.svg';
import youtubeIcon from '@/assets/icons/youtube.svg';
import linkedinIcon from '@/assets/icons/linkedin.svg';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/enums';

type FooterLink = { label: string; to: string };

/**
 * "Πληροφορίες" is the same for everyone and stays deliberately small — the
 * only thing that is genuinely informational for every visitor is the home
 * page. Sign-in links live under Υποστήριξη for guests, where they are
 * actionable.
 */
const INFO_LINKS: FooterLink[] = [{ label: 'Αρχική', to: '/' }] as const;

/** Support links, by role. A guest cannot file a request, so they get the
 * routes that let them become someone who can. */
function supportLinks(role: UserRole | null): FooterLink[] {
  switch (role) {
    case 'admin':
      return [
        { label: 'Αιτήματα χρηστών', to: '/messages' },
        { label: 'Νέο μήνυμα', to: '/messages?compose=1' },
      ];
    case 'organizer':
    case 'attendee':
      return [
        { label: 'Νέο αίτημα', to: '/messages?compose=1&support=1' },
        { label: 'Τα αιτήματά μου', to: '/messages' },
      ];
    default:
      return [
        { label: 'Σύνδεση', to: '/login' },
        { label: 'Εγγραφή', to: '/register' },
      ];
  }
}

/** The third column is what this particular account actually does here. */
function workspaceColumn(role: UserRole | null): { title: string; links: FooterLink[] } | null {
  switch (role) {
    case 'admin':
      return {
        title: 'Διαχείριση',
        links: [
          { label: 'Χρήστες', to: '/admin/users' },
          { label: 'Εκδηλώσεις', to: '/admin/events' },
          { label: 'Πίνακας ελέγχου', to: '/admin' },
        ],
      };
    case 'organizer':
      return {
        title: 'Οι εκδηλώσεις μου',
        links: [
          { label: 'Επισκόπηση', to: '/organizer' },
          { label: 'Οι εκδηλώσεις μου', to: '/organizer/events' },
          { label: 'Νέα εκδήλωση', to: '/organizer/events/new' },
        ],
      };
    case 'attendee':
      return {
        title: 'Ο λογαριασμός μου',
        links: [
          { label: 'Οι κρατήσεις μου', to: '/bookings/me' },
          { label: 'Τα στοιχεία μου', to: '/account' },
          { label: 'Ρυθμίσεις', to: '/settings' },
        ],
      };
    default:
      return {
        title: 'Εξερεύνηση',
        links: [
          { label: 'Όλες οι εκδηλώσεις', to: '/events' },
          { label: 'Αναζήτηση', to: '/events' },
        ],
      };
  }
}

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
      <h3 className="comfortaa-bold text-sm font-semibold text-neutral-800">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={`${title}-${l.label}`}>
            <Link
              to={l.to}
              className={cn(
                'comfortaa-regular text-sm text-neutral-500 transition-colors',
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
  const { user, isAuthenticated } = useAuth();
  const role = isAuthenticated && user ? user.role : null;

  const support = supportLinks(role);
  const workspace = workspaceColumn(role);

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_1fr_1fr_1.2fr] md:gap-12">
          <div className="order-1 md:order-4">
            <Link to="/" className="inline-flex items-baseline">
              <span className="comfortaa-bold text-xl tracking-tight text-[var(--nexus-purple)]">
                Nexus
              </span>
              <span className="comfortaa-semibold text-xl tracking-tight text-[var(--nexus-purple)]/90">
                Tickets
              </span>
            </Link>
            <p className="comfortaa-regular mt-4 max-w-sm text-sm text-neutral-500">
              Ανακάλυψε εκδηλώσεις και κράτησε εισιτήρια εύκολα, γρήγορα και με ασφάλεια.
            </p>
          </div>

          <div className="order-2 md:order-1">
            <FooterColumn title="Πληροφορίες" links={INFO_LINKS} />
          </div>

          <div className="order-3 md:order-2">
            <FooterColumn title="Υποστήριξη" links={support} />
          </div>

          {workspace && (
            <div className="order-4 md:order-3">
              <FooterColumn title={workspace.title} links={workspace.links} />
            </div>
          )}
        </div>

        <div className="mt-10">
          <p className="comfortaa-bold text-sm font-semibold text-neutral-800">Stay Connected</p>
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
          <p className="comfortaa-regular text-center text-xs text-neutral-500">
            © {new Date().getFullYear()} NexusTickets
          </p>
        </div>
      </div>
    </footer>
  );
}
