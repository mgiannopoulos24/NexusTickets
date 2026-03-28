import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { User } from '@/types/models';

import { getAccessToken } from '@/utils/api';

export type AuthState = {
  user: User | null;
  accessToken: string | null;
  isHydrating: boolean;
};

function readInitialAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return getAccessToken();
}

const initialState: AuthState = {
  user: null,
  accessToken: readInitialAccessToken(),
  isHydrating: !!readInitialAccessToken(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
    setAccessToken(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload;
    },
    setHydrating(state, action: PayloadAction<boolean>) {
      state.isHydrating = action.payload;
    },
    setSession(
      state,
      action: PayloadAction<{
        user: User;
        accessToken: string;
      }>,
    ) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isHydrating = false;
    },
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.isHydrating = false;
    },
  },
});

export const { setUser, setAccessToken, setHydrating, setSession, clearAuth } = authSlice.actions;

/** Widen input so selectors tolerate missing `auth` (e.g. HMR or misconfigured store) without throwing. */
type AuthRoot = { auth?: AuthState };

export function selectUser(state: AuthRoot): User | null {
  return state.auth?.user ?? null;
}

export function selectAccessToken(state: AuthRoot): string | null {
  return state.auth?.accessToken ?? null;
}

export function selectIsHydrating(state: AuthRoot): boolean {
  return state.auth?.isHydrating ?? false;
}

export function selectIsAuthenticated(state: AuthRoot): boolean {
  const a = state.auth;
  if (!a) return false;
  return !!a.user && !!a.accessToken;
}

export default authSlice.reducer;
