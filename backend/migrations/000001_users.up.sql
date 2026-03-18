CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  vat_number TEXT,
  role TEXT NOT NULL,
  account_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD CONSTRAINT users_role_chk CHECK (role IN ('admin', 'organizer', 'attendee', 'guest'));

ALTER TABLE users
  ADD CONSTRAINT users_account_status_chk CHECK (account_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS users_account_status_idx ON users (account_status);
