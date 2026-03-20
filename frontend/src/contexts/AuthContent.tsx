import { createContext, useState, useEffect, useContext } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '@/types/user';

interface LoginResponse {
  data: User;
  token: string;
}

interface MeResponse {
  data: User;
}

interface RegisterRequest {
  username: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  vat_number: string | null;
}

interface LocationState {
  from?: {
    pathname?: string;
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  setUser: Dispatch<SetStateAction<User | null>>;
}

/* eslint-disable react-refresh/only-export-components */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  const logout = async () => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('auth_token');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/');
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      const storedToken = sessionStorage.getItem('auth_token');

      if (storedToken) {
        setToken(storedToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

        try {
          const response = await axios.get<MeResponse>('/api/users/me');
          setUser(response.data.data);
        } catch (error) {
          console.error('Session token is invalid. Logging out.', error);
          // await logout();
        }
      }
      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const login = async (identifier: string, password: string) => {
    const response = await axios.post<LoginResponse>('/api/auth/login', {
      identifier,
      password,
    });

    if (response.data?.data && response.data.token) {
      const { data: loggedInUser, token: authToken } = response.data;
      setUser(loggedInUser);
      setToken(authToken);
      sessionStorage.setItem('auth_token', authToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

      const from = locationState?.from?.pathname || null;

      if (loggedInUser.role === 'admin') {
        navigate(from && from.startsWith('/admin') ? from : '/admin/dashboard');
      } else {
        navigate(from || '/homepage');
      }
    }
  };

  const register = async (userData: RegisterRequest) => {
    const response = await axios.post<LoginResponse>('/api/auth/register', {
      user: userData,
    });

    if (response.data?.data && response.data.token) {
      const { data: newUser, token: authToken } = response.data;
      setUser(newUser);
      setToken(authToken);
      sessionStorage.setItem('auth_token', authToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      navigate('/homepage');
    }
  };

  const value = {
    isAuthenticated: !isLoading && !!user,
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    setUser,
  };

  /* eslint-disable react-refresh/only-export-components */
  return <AuthContext.Provider value={value}>{!isLoading && children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
