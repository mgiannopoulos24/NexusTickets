import type { AccountStatus, BookingStatus, EventStatus, UserRole } from '@/types/enums';
import type { EventDetail } from '@/types/eventDetail';

export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  vat_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketType {
  /** Omitted when creating a new ticket type in an update payload. */
  id: string;
  name: string;
  price: number;
  quantity: number;
  available: number;
}

export interface Category {
  id: string;
  name: string;
  created_at?: string;
}

export interface EventPhoto {
  id: string;
  url: string;
  position: number;
}

export interface Event {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  venue: string;
  /** The DTD's <EventType> (e.g. "concert"); distinct from `categories`. */
  event_type: string;
  featured_image_url?: string | null;
  address?: string | null;
  city: string;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_at: string;
  end_at: string;
  capacity: number;
  status: EventStatus;
  categories: string[];
  ticket_types: TicketType[];
  photos: EventPhoto[];
  /** Seats sold across all ticket types. */
  tickets_sold: number;
  /** Seats still available across all ticket types. */
  tickets_remaining: number;
  event_detail?: EventDetail;
  created_at: string;
  updated_at: string;
}

/** Enough of the event to render a booking row. */
export interface BookingEventSummary {
  id: string;
  /** Lets the attendee open a message to the organizer (assignment §10). */
  organizer_id: string;
  title: string;
  venue: string;
  city: string;
  start_at: string;
  end_at: string;
  status: EventStatus;
}

/** Who made the booking — shown to the organizer. */
export interface BookingAttendee {
  id: string;
  username: string;
  full_name: string;
  email: string;
}

export interface BookingTicketType {
  id: string;
  name: string;
  price: number;
}

export interface Booking {
  id: string;
  user_id: string;
  event_id: string;
  ticket_type_id: string;
  quantity: number;
  total_cost: number;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  /** Set once the booking is confirmed; kept if the event is cancelled later. */
  confirmed_at?: string;
  /** Set while the booking is pending: when the seat hold lapses. */
  hold_expires_at?: string;

  event?: BookingEventSummary;
  attendee?: BookingAttendee;
  ticket_type?: BookingTicketType;
}
