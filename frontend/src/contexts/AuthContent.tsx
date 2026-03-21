import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { User } from '@/types/models';
import {
  AUTH_SESSION_CLEARED_EVENT,
  AUTH_TOKEN_UPDATED_EVENT,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '@/utils/api';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
};

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

type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_expires_in: number;
  refresh_expires_in: number;
};

type LocationState = {
  from?: { pathname?: string };
  pendingApproval?: boolean;
};

function assertData<T>(res: Response, body: ApiEnvelope<T>): T {
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? 'Σφάλμα αιτήματος');
  }
  if (body.data === null || body.data === undefined) {
    throw new Error('Άκυρη απάντηση');
  }
  return body.data;
}

async function fetchUserMe(accessToken: string): Promise<User> {
  const res = await fetch('/api/v1/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const json = (await res.json()) as ApiEnvelope<User>;
  return assertData(res, json);
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  isHydrating: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  setUser: Dispatch<SetStateAction<User | null>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken);
  const [isHydrating, setIsHydrating] = useState<boolean>(() => !!getAccessToken());
  const navigate = useNavigate();
  const location = useLocation();

  const clearClientSession = useCallback(() => {
    clearTokens();
    setUser(null);
    setAccessToken(null);
  }, []);

  useEffect(() => {
    const onCleared = () => {
      setUser(null);
      setAccessToken(null);
    };
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, onCleared);
  }, []);

  useEffect(() => {
    const onTokenUpdated = () => {
      setAccessToken(getAccessToken());
    };
    window.addEventListener(AUTH_TOKEN_UPDATED_EVENT, onTokenUpdated);
    return () => window.removeEventListener(AUTH_TOKEN_UPDATED_EVENT, onTokenUpdated);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    void fetchUserMe(token)
      .then((u) => {
        if (!cancelled) {
          setUser(u);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearClientSession();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearClientSession]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = (await res.json()) as ApiEnvelope<AuthTokens>;
      const tokens = assertData(res, json);
      setTokens(tokens.access_token, tokens.refresh_token);
      setAccessToken(tokens.access_token);
      const me = await fetchUserMe(tokens.access_token);
      setUser(me);
      toast.success(`Καλώς ήρθες, ${me.username}`);

      const from = (location.state as LocationState | null)?.from?.pathname;
      const target = from && from !== '/login' ? from : '/';
      navigate(target, { replace: true });
    },
    [navigate, location.state],
  );

  const register = useCallback(
    async (userData: RegisterRequest) => {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const json = (await res.json()) as ApiEnvelope<{
        id: string;
        username: string;
        email: string;
        account_status: string;
      }>;
      assertData(res, json);
      navigate('/login', { replace: true, state: { pendingApproval: true } });
    },
    [navigate],
  );

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
      } catch {
        /* still clear client session */
      }
    }
    clearClientSession();
    navigate('/');
  }, [clearClientSession, navigate]);

  const value = useMemo(
    () => ({
      isAuthenticated: !!user && !!accessToken,
      user,
      accessToken,
      isHydrating,
      login,
      register,
      logout,
      setUser,
    }),
    [user, accessToken, isHydrating, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
