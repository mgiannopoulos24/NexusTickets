import { lazy } from 'react';
import type { ReactNode } from 'react';
/* eslint-disable react-refresh/only-export-components */

import type { UserRole } from '@/types/enums';

type RouteConfig = {
  path: string;
  element: ReactNode;
  protected?: boolean;
  roles?: UserRole[];
};

const Home = lazy(() => import('@/pages/Home'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));

const routes: RouteConfig[] = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/admin',
    element: <AdminDashboard />,
    protected: true,
    roles: ['admin'],
  },
];

export default routes;
