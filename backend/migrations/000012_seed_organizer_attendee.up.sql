-- Dev/demo users: organizer and attendee (admin is seeded in 000009).
-- Password for both: ChangeMe123! (same as admin seed).

INSERT INTO users (
  id,
  username,
  password_hash,
  first_name,
  last_name,
  email,
  phone,
  address,
  city,
  country,
  vat_number,
  role,
  account_status
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'organizer',
  crypt('ChangeMe123!', gen_salt('bf', 12)),
  'Demo',
  'Organizer',
  'organizer@nexustickets.local',
  NULL,
  NULL,
  'Αθήνα',
  'GR',
  NULL,
  'organizer',
  'approved'
) ON CONFLICT (username) DO NOTHING;

INSERT INTO users (
  id,
  username,
  password_hash,
  first_name,
  last_name,
  email,
  phone,
  address,
  city,
  country,
  vat_number,
  role,
  account_status
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  'attendee',
  crypt('ChangeMe123!', gen_salt('bf', 12)),
  'Demo',
  'Attendee',
  'attendee@nexustickets.local',
  NULL,
  NULL,
  'Θεσσαλονίκη',
  'GR',
  NULL,
  'attendee',
  'approved'
) ON CONFLICT (username) DO NOTHING;
