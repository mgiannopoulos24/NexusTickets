import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

import type { AuthTokensPayload, RegisterRequest } from '@/types/auth';
import type { User } from '@/types/models';
import {
  baseApi,
  clearTokens,
  clearTokensAndNotify,
  getRefreshToken,
  setTokens,
} from '@/utils/api';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
};

function assertEnvelopeData<T>(body: ApiEnvelope<T>): T {
  if (body.error) {
    throw new Error(body.error.message ?? 'Σφάλμα αιτήματος');
  }
  if (body.data === null || body.data === undefined) {
    throw new Error('Άκυρη απάντηση');
  }
  return body.data;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<User, void>({
      query: () => ({ url: '/users/me', method: 'GET' }),
      transformResponse: (response: unknown): User => {
        const body = response as ApiEnvelope<User>;
        return assertEnvelopeData(body);
      },
    }),

    login: build.mutation<User, { username: string; password: string }>({
      async queryFn(
        { username, password },
        _api,
        _extraOptions,
        baseQuery,
      ): Promise<{ data: User } | { error: FetchBaseQueryError }> {
        const loginRes = await baseQuery({
          url: '/auth/login',
          method: 'POST',
          body: { username: username.trim(), password },
        });
        if (loginRes.error) {
          return { error: loginRes.error as FetchBaseQueryError };
        }
        const tokens = assertEnvelopeData(loginRes.data as ApiEnvelope<AuthTokensPayload>);
        setTokens(tokens.access_token, tokens.refresh_token);

        const meRes = await baseQuery({ url: '/users/me', method: 'GET' });
        if (meRes.error) {
          clearTokens();
          return { error: meRes.error as FetchBaseQueryError };
        }
        const user = assertEnvelopeData(meRes.data as ApiEnvelope<User>);
        return { data: user };
      },
    }),

    register: build.mutation<void, RegisterRequest>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: '/auth/register',
          method: 'POST',
          body,
        });
        if (res.error) {
          return { error: res.error as FetchBaseQueryError };
        }
        const envelope = res.data as ApiEnvelope<unknown>;
        if (envelope.error) {
          return {
            error: {
              status: 400,
              data: envelope.error,
            } as FetchBaseQueryError,
          };
        }
        return { data: undefined };
      },
    }),

    logout: build.mutation<void, void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const refresh = getRefreshToken();
        if (refresh) {
          try {
            await baseQuery({
              url: '/auth/logout',
              method: 'POST',
              body: { refresh_token: refresh },
            });
          } catch {
            /* still clear local session */
          }
        }
        clearTokensAndNotify();
        return { data: undefined };
      },
    }),
  }),
});

export const {
  useGetMeQuery,
  useLazyGetMeQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} = authApi;
