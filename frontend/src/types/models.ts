import type { AccountStatus, BookingStatus, EventStatus, UserRole } from '@/types/enums';

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
  id: string;
  name: string;
  price: number;
  quantity: number;
  available: number;
}

export interface Event {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  venue: string;
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
  created_at: string;
  updated_at: string;
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
}
