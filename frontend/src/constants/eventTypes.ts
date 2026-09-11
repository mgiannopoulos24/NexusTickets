/**
 * <EventType> from the assignment DTD — the kind of event, distinct from the
 * many-valued Category taxonomy. The value stored is the English slug (which is
 * what the XML/JSON export carries); the label is what the UI shows.
 */
import { tr } from '@/lib/i18n';

export const EVENT_TYPE_VALUES = [
  'concert',
  'festival',
  'performance',
  'theatre',
  'exhibition',
  'conference',
  'workshop',
  'match',
  'screening',
  'other',
] as const;

export type EventTypeValue = (typeof EVENT_TYPE_VALUES)[number];

/** Options for a select, labelled in the current language. */
export function eventTypeOptions(): Array<{ value: EventTypeValue; label: string }> {
  return EVENT_TYPE_VALUES.map((value) => ({ value, label: tr(`eventTypes.${value}`) }));
}

export const DEFAULT_EVENT_TYPE: EventTypeValue = 'concert';

/** Human label for a stored event type; unknown values are shown as-is. */
export function eventTypeLabel(value: string): string {
  const known = (EVENT_TYPE_VALUES as readonly string[]).includes(value);
  return known ? tr(`eventTypes.${value}`) : value;
}
