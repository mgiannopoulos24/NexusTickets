import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useLoginMutation, useLogoutMutation, useRegisterMutation } from '@/app/authApi';
import {
  selectAccessToken,
  selectIsHydrating,
  selectUser,
  setSession,
  setUser,
} from '@/app/authSlice';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import type { RegisterRequest } from '@/types/auth';
import type { User } from '@/types/models';
import { getAccessToken } from '@/utils/api';
import { wsClient } from '@/utils/wsClient';
import { tr } from '@/lib/i18n';

type LocationState = {
  from?: { pathname?: string };
  pendingApproval?: boolean;
};

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector(selectUser);
  const accessToken = useAppSelector(selectAccessToken);
  const isHydrating = useAppSelector(selectIsHydrating);

  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();
  const [logoutMutation] = useLogoutMutation();

  const login = useCallback(
    async (username: string, password: string) => {
      const me = await loginMutation({ username, password }).unwrap();
      const token = getAccessToken();
      if (!token) throw new Error(tr('errors.invalidSession'));
      dispatch(setSession({ user: me, accessToken: token }));
      toast.success(tr('auth.welcome', { name: me.username }));

      const from = (location.state as LocationState | null)?.from?.pathname;
      // A redirect back to the page that required login wins; otherwise the
      // administrator lands on user management (assignment §3) and everyone
      // else on the home page (§5).
      const home = me.role === 'admin' ? '/admin/users' : '/';
      const target = from && from !== '/login' ? from : home;
      navigate(target, { replace: true });
    },
    [dispatch, loginMutation, navigate, location.state],
  );

  const register = useCallback(
    async (userData: RegisterRequest) => {
      await registerMutation(userData).unwrap();
      navigate('/register/pending', { replace: true });
    },
    [navigate, registerMutation],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation().unwrap();
    } catch {
      /* Session cleared via clearTokensAndNotify when possible */
    }
    wsClient.disconnect();
    navigate('/');
  }, [logoutMutation, navigate]);

  const setUserDispatch = useCallback(
    (value: SetStateAction<User | null>) => {
      dispatch(setUser(typeof value === 'function' ? value(user) : value));
    },
    [dispatch, user],
  );

  return useMemo(
    () => ({
      isAuthenticated: !!user && !!accessToken,
      user,
      accessToken,
      isHydrating,
      login,
      register,
      logout,
      setUser: setUserDispatch as Dispatch<SetStateAction<User | null>>,
    }),
    [user, accessToken, isHydrating, login, register, logout, setUserDispatch],
  );
}
