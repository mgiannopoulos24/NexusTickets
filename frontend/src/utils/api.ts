import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const AUTH_TOKEN_UPDATED_EVENT = 'nexus-auth-token-updated';
export const AUTH_SESSION_CLEARED_EVENT = 'nexus-auth-session-cleared';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  window.dispatchEvent(new CustomEvent(AUTH_TOKEN_UPDATED_EVENT));
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearTokensAndNotify(): void {
  clearTokens();
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CLEARED_EVENT));
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status !== 401) {
    return result;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokensAndNotify();
    return result;
  }

  const refreshResult = await rawBaseQuery(
    {
      url: '/auth/refresh',
      method: 'POST',
      body: { refresh_token: refreshToken },
    },
    api,
    extraOptions,
  );

  if (refreshResult.data) {
    const envelope = refreshResult.data as {
      data: {
        access_token: string;
        refresh_token: string;
      };
    };
    setTokens(envelope.data.access_token, envelope.data.refresh_token);
    result = await rawBaseQuery(args, api, extraOptions);
  } else {
    clearTokensAndNotify();
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Event', 'Booking', 'User', 'Message'],
  endpoints: () => ({}),
});
