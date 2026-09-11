import type { MessageParticipant } from '@/types/message';
import { tr } from '@/lib/i18n';

/** Display name, falling back to the username when the profile has no name. */
export function displayName(p: MessageParticipant | undefined): string {
  if (!p) return tr('common.unknownUser');
  return p.full_name.trim() || p.username;
}

export function roleLabel(p: MessageParticipant | undefined): string {
  if (!p) return '';
  const key = `role.${p.role}`;
  const label = tr(key);
  return label === key ? p.role : label;
}

/** "Re: subject", without stacking prefixes on a reply to a reply. */
export function replySubject(subject: string): string {
  const trimmed = subject.trim();
  return /^re:\s*/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}
