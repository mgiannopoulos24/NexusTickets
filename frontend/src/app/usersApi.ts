import type { User } from '@/types/models';
import { baseApi } from '@/utils/api';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

function unwrap<T>(response: unknown): T {
  const body = response as ApiEnvelope<T>;
  if (body.error) {
    throw new Error(body.error.message ?? 'Σφάλμα αιτήματος');
  }
  if (body.data === null || body.data === undefined) {
    throw new Error('Άκυρη απάντηση');
  }
  return body.data;
}

export type ListUsersArgs = {
  limit: number;
  offset: number;
};

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listUsers: build.query<User[], ListUsersArgs>({
      query: ({ limit, offset }) => ({
        url: `/users/admin?limit=${limit}&offset=${offset}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown): User[] => unwrap<User[]>(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map((u) => ({ type: 'User' as const, id: u.id })),
              { type: 'User' as const, id: 'LIST' },
            ]
          : [{ type: 'User' as const, id: 'LIST' }],
    }),

    getUser: build.query<User, string>({
      query: (id) => ({ url: `/users/admin/${encodeURIComponent(id)}`, method: 'GET' }),
      transformResponse: (response: unknown): User => unwrap<User>(response),
      providesTags: (_result, _err, id) => [{ type: 'User', id }],
    }),

    approveUser: build.mutation<User, string>({
      query: (id) => ({
        url: `/users/admin/${encodeURIComponent(id)}/approve`,
        method: 'PATCH',
      }),
      transformResponse: (response: unknown): User => unwrap<User>(response),
      invalidatesTags: (_result, _err, id) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),

    rejectUser: build.mutation<User, string>({
      query: (id) => ({
        url: `/users/admin/${encodeURIComponent(id)}/reject`,
        method: 'PATCH',
      }),
      transformResponse: (response: unknown): User => unwrap<User>(response),
      invalidatesTags: (_result, _err, id) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListUsersQuery,
  useGetUserQuery,
  useApproveUserMutation,
  useRejectUserMutation,
} = usersApi;
