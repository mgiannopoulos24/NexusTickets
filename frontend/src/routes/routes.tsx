import { lazy } from 'react';
import type { ReactNode } from 'react';
/* eslint-disable react-refresh/only-export-components */

import type { UserRole } from '@/types/enums';

export type RouteLayout = 'app' | 'none';

type RouteConfig = {
  path: string;
  element: ReactNode;
  layout?: RouteLayout;
  protected?: boolean;
  roles?: UserRole[];
};

const Home = lazy(() => import('@/pages/Home'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const RegisterPendingPage = lazy(() => import('@/pages/RegisterPendingPage'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));

const routes: RouteConfig[] = [
  {
    path: '/',
    element: <Home />,
    layout: 'app',
  },
  {
    path: '/login',
    element: <LoginPage />,
    layout: 'app',
  },
  {
    path: '/register',
    element: <RegisterPage />,
    layout: 'app',
  },
  {
    path: '/register/pending',
    element: <RegisterPendingPage />,
    layout: 'app',
  },
  {
    path: '/admin',
    element: <AdminDashboard />,
    layout: 'app',
    protected: true,
    roles: ['admin'],
  },
];

export default routes;
