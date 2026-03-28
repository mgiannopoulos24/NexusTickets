import { useEffect, type ReactNode } from 'react';

import { useLazyGetMeQuery } from '@/app/authApi';
import { clearAuth, setAccessToken, setHydrating, setSession } from '@/app/authSlice';
import { clearMessagingState } from '@/app/messagingSlice';
import { useAppDispatch } from '@/app/hooks';
import {
  AUTH_SESSION_CLEARED_EVENT,
  AUTH_TOKEN_UPDATED_EVENT,
  clearTokensAndNotify,
  getAccessToken,
} from '@/utils/api';

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useAppDispatch();
  const [triggerGetMe] = useLazyGetMeQuery();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      dispatch(setHydrating(false));
      return;
    }

    let cancelled = false;
    void triggerGetMe()
      .unwrap()
      .then((user) => {
        if (!cancelled) {
          const t = getAccessToken();
          if (t) dispatch(setSession({ user, accessToken: t }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTokensAndNotify();
        }
      })
      .finally(() => {
        if (!cancelled) dispatch(setHydrating(false));
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, triggerGetMe]);

  useEffect(() => {
    const onCleared = () => {
      dispatch(clearAuth());
      dispatch(clearMessagingState());
    };
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, onCleared);
  }, [dispatch]);

  useEffect(() => {
    const onTokenUpdated = () => {
      dispatch(setAccessToken(getAccessToken()));
    };
    window.addEventListener(AUTH_TOKEN_UPDATED_EVENT, onTokenUpdated);
    return () => window.removeEventListener(AUTH_TOKEN_UPDATED_EVENT, onTokenUpdated);
  }, [dispatch]);

  return children;
}
