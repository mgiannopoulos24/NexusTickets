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
  vat_number: string | null;
};

export type AuthTokensPayload = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_expires_in: number;
  refresh_expires_in: number;
};
