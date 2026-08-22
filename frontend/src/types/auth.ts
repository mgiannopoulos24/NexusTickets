import type { AssignableRole } from '@/types/enums';

export type RegisterRequest = {
  username: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  vat_number: string | null;
  /** 'attendee' (default) or 'organizer'. */
  role: AssignableRole;
};

export type AuthTokensPayload = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_expires_in: number;
  refresh_expires_in: number;
};
