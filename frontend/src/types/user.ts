export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'attendee' | 'organizer' | 'admin' | 'guest';
  account_status: 'pending' | 'approved' | 'rejected';
  phone_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  vat_number: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
