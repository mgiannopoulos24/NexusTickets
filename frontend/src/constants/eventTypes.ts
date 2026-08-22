/**
 * <EventType> from the assignment DTD — the kind of event, distinct from the
 * many-valued Category taxonomy. The value stored is the English slug (which is
 * what the XML/JSON export carries); the label is what the UI shows.
 */
export const EVENT_TYPES = [
  { value: 'concert', label: 'Συναυλία' },
  { value: 'festival', label: 'Φεστιβάλ' },
  { value: 'performance', label: 'Παράσταση' },
  { value: 'theatre', label: 'Θέατρο' },
  { value: 'exhibition', label: 'Έκθεση' },
  { value: 'conference', label: 'Συνέδριο' },
  { value: 'workshop', label: 'Εργαστήριο / Σεμινάριο' },
  { value: 'match', label: 'Αγώνας' },
  { value: 'screening', label: 'Προβολή' },
  { value: 'other', label: 'Άλλο' },
] as const;

export type EventTypeValue = (typeof EVENT_TYPES)[number]['value'];

export const DEFAULT_EVENT_TYPE: EventTypeValue = 'concert';

/** Human label for a stored event type; unknown values are shown as-is. */
export function eventTypeLabel(value: string): string {
  const match = EVENT_TYPES.find((t) => t.value === value);
  return match ? match.label : value;
}
