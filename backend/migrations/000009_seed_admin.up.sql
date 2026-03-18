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
  '00000000-0000-0000-0000-000000000001',
  'admin',
  crypt('ChangeMe123!', gen_salt('bf', 12)),
  'Admin',
  'User',
  'admin@nexustickets.local',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'admin',
  'approved'
) ON CONFLICT (username) DO NOTHING;
