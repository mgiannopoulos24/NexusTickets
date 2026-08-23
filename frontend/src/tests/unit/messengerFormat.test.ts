import { describe, expect, it } from 'vitest';

import { insertAtCaret } from '@/components/messenger/insertAtCaret';
import { avatarClass, displayName, initials, roleLabel } from '@/components/messenger/participant';
import { clockTime, dayLabel, isNewDay, listTimestamp } from '@/components/messenger/timeFormat';
import type { MessageParticipant } from '@/types/message';

function person(over: Partial<MessageParticipant> = {}): MessageParticipant {
  return { id: 'u-1', username: 'demo', full_name: 'Demo Organizer', role: 'organizer', ...over };
}

describe('participant display', () => {
  it('prefers the full name', () => {
    expect(displayName(person())).toBe('Demo Organizer');
  });

  it('falls back to the username when there is no name', () => {
    expect(displayName(person({ full_name: '   ' }))).toBe('demo');
  });

  it('handles a missing participant', () => {
    expect(displayName(undefined)).toBe('Άγνωστος χρήστης');
    expect(initials(undefined)).toBe('ΑΧ');
  });

  it('builds a two-letter monogram', () => {
    expect(initials(person())).toBe('DO');
    expect(initials(person({ full_name: 'Μαρία' }))).toBe('ΜΑ');
  });

  it('labels the role, and marks support', () => {
    expect(roleLabel(person())).toBe('Διοργανωτής');
    expect(roleLabel(person({ role: 'attendee' }))).toBe('Συμμετέχων');
    expect(roleLabel(person({ role: 'admin' }), true)).toBe('Υποστήριξη');
  });

  it('gives the same person the same avatar colour every time', () => {
    expect(avatarClass('u-1')).toBe(avatarClass('u-1'));
  });
});

describe('messenger timestamps', () => {
  const now = new Date('2026-03-10T12:00:00Z');

  it('formats the time under a bubble', () => {
    expect(clockTime('2026-03-10T09:05:00Z')).toMatch(/\d{2}:\d{2}/);
  });

  it('ignores an unparseable date instead of printing NaN', () => {
    expect(clockTime('not-a-date')).toBe('');
    expect(dayLabel('not-a-date')).toBe('');
    expect(listTimestamp('not-a-date')).toBe('');
  });

  it('names today and yesterday', () => {
    expect(dayLabel('2026-03-10T08:00:00Z', now)).toBe('Σήμερα');
    expect(dayLabel('2026-03-09T08:00:00Z', now)).toBe('Χθες');
  });

  it('spells out an older day, with the year once it is a different one', () => {
    expect(dayLabel('2026-03-01T08:00:00Z', now)).toContain('Μαρτίου');
    expect(dayLabel('2025-03-01T08:00:00Z', now)).toContain('2025');
  });

  it('shortens the sidebar stamp as messages age', () => {
    expect(listTimestamp('2026-03-10T08:00:00Z', now)).toMatch(/\d{2}:\d{2}/);
    expect(listTimestamp('2026-03-09T08:00:00Z', now)).toBe('Χθες');
    expect(listTimestamp('2026-01-05T08:00:00Z', now)).toMatch(/\d{2}\/\d{2}/);
  });

  it('starts a new day separator only when the date changes', () => {
    expect(isNewDay(undefined, '2026-03-10T08:00:00Z')).toBe(true);
    expect(isNewDay('2026-03-10T09:00:00Z', '2026-03-10T15:00:00Z')).toBe(false);
    expect(isNewDay('2026-03-09T12:00:00Z', '2026-03-10T12:00:00Z')).toBe(true);
  });
});

describe('emoji insertion', () => {
  it('splices at the caret', () => {
    expect(insertAtCaret('γεια σου', 4, 4, '😀')).toEqual({ text: 'γεια😀 σου', caret: 6 });
  });

  it('replaces the selection', () => {
    expect(insertAtCaret('γεια σου', 0, 4, '👋')).toEqual({ text: '👋 σου', caret: 2 });
  });

  it('appends at the end of an empty box', () => {
    expect(insertAtCaret('', 0, 0, '🎉')).toEqual({ text: '🎉', caret: 2 });
  });

  it('clamps a caret past the end', () => {
    expect(insertAtCaret('abc', 99, 99, '!')).toEqual({ text: 'abc!', caret: 4 });
  });
});
