import { Link } from 'react-router-dom';

import facebookIcon from '@/assets/icons/facebook.svg';
import instagramIcon from '@/assets/icons/instagram.svg';
import tiktokIcon from '@/assets/icons/tiktok.svg';
import youtubeIcon from '@/assets/icons/youtube.svg';
import linkedinIcon from '@/assets/icons/linkedin.svg';
import { useLang } from '@/contexts/langContextCore';
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
const INFO_LINKS: FooterLink[] = [{ label: 'footer.home', to: '/' }] as const;

/** Support links, by role. A guest cannot file a request, so they get the
 * routes that let them become someone who can. */
function supportLinks(role: UserRole | null): FooterLink[] {
  switch (role) {
    case 'admin':
      return [
        { label: 'footer.userRequests', to: '/admin/support' },
        { label: 'footer.closedRequests', to: '/admin/support?status=closed' },
      ];
    case 'organizer':
    case 'attendee':
      return [
        { label: 'footer.newRequest', to: '/support?new=1' },
        { label: 'footer.myRequests', to: '/support' },
      ];
    default:
      return [
        { label: 'nav.login', to: '/login' },
        { label: 'nav.register', to: '/register' },
      ];
  }
}

/** The third column is what this particular account actually does here. */
function workspaceColumn(role: UserRole | null): { title: string; links: FooterLink[] } | null {
  switch (role) {
    case 'admin':
      return {
        title: 'footer.admin',
        links: [
          { label: 'footer.users', to: '/admin/users' },
          { label: 'footer.events', to: '/admin/events' },
          { label: 'footer.dashboard', to: '/admin' },
          { label: 'footer.myEvents', to: '/organizer/events' },
        ],
      };
    case 'organizer':
      return {
        title: 'footer.myEvents',
        links: [
          { label: 'footer.overview', to: '/organizer' },
          { label: 'footer.myEvents', to: '/organizer/events' },
          { label: 'footer.newEvent', to: '/organizer/events/new' },
        ],
      };
    case 'attendee':
      return {
        title: 'footer.myAccount',
        links: [
          { label: 'footer.myBookings', to: '/bookings/me' },
          { label: 'footer.myDetails', to: '/account' },
          { label: 'footer.settings', to: '/settings' },
        ],
      };
    default:
      return {
        title: 'footer.explore',
        links: [
          { label: 'footer.allEvents', to: '/events' },
          { label: 'footer.search', to: '/events' },
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

/** `title` and each link `label` are translation keys. */
function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  const { t } = useLang();
  return (
    <div>
      <h3 className="comfortaa-bold text-sm font-semibold text-neutral-800">{t(title)}</h3>
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
              {t(l.label)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useLang();
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
              {t('footer.tagline')}
            </p>
          </div>

          <div className="order-2 md:order-1">
            <FooterColumn title="footer.info" links={INFO_LINKS} />
          </div>

          <div className="order-3 md:order-2">
            <FooterColumn title="footer.support" links={support} />
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
