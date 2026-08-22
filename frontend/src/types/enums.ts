export const UserRoles = {
  admin: 'admin',
  organizer: 'organizer',
  attendee: 'attendee',
  guest: 'guest',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export const AccountStatuses = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
} as const;

export type AccountStatus = (typeof AccountStatuses)[keyof typeof AccountStatuses];

export const EventStatuses = {
  draft: 'draft',
  published: 'published',
  completed: 'completed',
  cancelled: 'cancelled',
  /** Legacy value from rows written before hard deletion; never produced now. */
  deleted: 'deleted',
} as const;

export type EventStatus = (typeof EventStatuses)[keyof typeof EventStatuses];

/** The roles a person may choose at registration or be switched to by an admin. */
export const AssignableRoles = ['attendee', 'organizer'] as const;

export type AssignableRole = (typeof AssignableRoles)[number];

export const BookingStatuses = {
  pending: 'pending',
  confirmed: 'confirmed',
  cancelled: 'cancelled',
} as const;

export type BookingStatus = (typeof BookingStatuses)[keyof typeof BookingStatuses];
