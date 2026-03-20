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
  cancelled: 'cancelled',
  deleted: 'deleted',
} as const;

export type EventStatus = (typeof EventStatuses)[keyof typeof EventStatuses];

export const BookingStatuses = {
  pending: 'pending',
  confirmed: 'confirmed',
  cancelled: 'cancelled',
} as const;

export type BookingStatus = (typeof BookingStatuses)[keyof typeof BookingStatuses];
