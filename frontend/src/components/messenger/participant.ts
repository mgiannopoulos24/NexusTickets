import type { MessageParticipant } from '@/types/message';

/** Display name, falling back to the username when the profile has no name. */
export function displayName(p: MessageParticipant | undefined): string {
  if (!p) return 'Άγνωστος χρήστης';
  return p.full_name.trim() || p.username;
}

/** Two-letter monogram for the avatar bubble. */
export function initials(p: MessageParticipant | undefined): string {
  const name = displayName(p);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('el-GR');
  return (parts[0][0] + parts[1][0]).toLocaleUpperCase('el-GR');
}

const ROLE_LABEL: Record<string, string> = {
  organizer: 'Διοργανωτής',
  attendee: 'Συμμετέχων',
  admin: 'Διαχειριστής',
};

export function roleLabel(p: MessageParticipant | undefined, support = false): string {
  if (support) return 'Υποστήριξη';
  if (!p) return '';
  return ROLE_LABEL[p.role] ?? p.role;
}

/**
 * A stable colour per person, so the same correspondent always gets the same
 * avatar — easier to scan a list than one uniform grey.
 */
export function avatarClass(id: string): string {
  const palette = [
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-sky-100 text-sky-700',
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
