import NotAuthorized from './NotAuthorized';
import { useAuth } from '@/contexts/AuthContent';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User } from '@/types/user';

type AllowedRole = Exclude<User['role'], 'guest'>;

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles: AllowedRole[];
};

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-lg text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (user.role === 'guest' || !allowedRoles.includes(user.role)) {
    return <NotAuthorized />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
