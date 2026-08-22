import { unwrap, unwrapList } from '@/app/apiEnvelope';
import type { AssignableRole } from '@/types/enums';
import type { User } from '@/types/models';
import { baseApi } from '@/utils/api';

/** Profile fields a user may change about themselves. */
export type UpdateProfileRequest = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  vat_number?: string | null;
};

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
      transformResponse: (response: unknown): User[] => unwrapList<User>(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map((u) => ({ type: 'User' as const, id: u.id })),
              { type: 'User' as const, id: 'LIST' },
            ]
          : [{ type: 'User' as const, id: 'LIST' }],
    }),

    /** The signed-in user's own profile. */
    getMe: build.query<User, void>({
      query: () => ({ url: '/users/me', method: 'GET' }),
      transformResponse: (response: unknown): User => unwrap<User>(response),
      providesTags: [{ type: 'User', id: 'ME' }],
    }),

    updateMe: build.mutation<User, UpdateProfileRequest>({
      query: (body) => ({ url: '/users/me', method: 'PATCH', body }),
      transformResponse: (response: unknown): User => unwrap<User>(response),
      invalidatesTags: [{ type: 'User', id: 'ME' }],
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

    /** Switch an account between attendee and organizer (admin only). */
    changeUserRole: build.mutation<User, { id: string; role: AssignableRole }>({
      query: ({ id, role }) => ({
        url: `/users/admin/${encodeURIComponent(id)}/role`,
        method: 'PATCH',
        body: { role },
      }),
      transformResponse: (response: unknown): User => unwrap<User>(response),
      invalidatesTags: (_result, _err, { id }) => [
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
  useGetMeQuery,
  useUpdateMeMutation,
  useListUsersQuery,
  useGetUserQuery,
  useApproveUserMutation,
  useRejectUserMutation,
  useChangeUserRoleMutation,
} = usersApi;
