import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { setCredentials, loggedOut } from '@/utils/authSlice';
import type { RootState } from '@/app/store';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
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

  const state = api.getState() as RootState;
  if (!state.auth.refreshToken) {
    api.dispatch(loggedOut());
    return result;
  }

  const refreshResult = await rawBaseQuery(
    {
      url: '/auth/refresh',
      method: 'POST',
      body: { refresh_token: state.auth.refreshToken },
    },
    api,
    extraOptions,
  );

  if (refreshResult.data) {
    const data = refreshResult.data as {
      data: {
        access_token: string;
        refresh_token: string;
      };
    };
    api.dispatch(
      setCredentials({
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
      }),
    );
    result = await rawBaseQuery(args, api, extraOptions);
  } else {
    api.dispatch(loggedOut());
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
});
