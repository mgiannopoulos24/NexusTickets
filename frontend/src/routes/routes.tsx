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
const EventsBrowsePage = lazy(() => import('@/pages/events/EventsBrowsePage'));
const EventsIndexPage = lazy(() => import('@/pages/events/EventsIndexPage'));
const EventDetailPage = lazy(() => import('@/pages/events/EventDetailPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const PendingApprovalPage = lazy(() => import('@/components/auth/PendingApprovalPage'));
const UnauthorizedPage = lazy(() => import('@/components/auth/UnauthorizedPage'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminEventsPage = lazy(() => import('@/pages/admin/AdminEventsPage'));
const AdminEventEditPage = lazy(() => import('@/pages/admin/AdminEventEditPage'));
const OrganizerDashboardPage = lazy(() => import('@/pages/organizer/OrganizerDashboardPage'));
const OrganizerEventsPage = lazy(() => import('@/pages/organizer/OrganizerEventsPage'));
const OrganizerEventNewPage = lazy(() => import('@/pages/organizer/OrganizerEventNewPage'));
const OrganizerEventEditPage = lazy(() => import('@/pages/organizer/OrganizerEventEditPage'));

const routes: RouteConfig[] = [
  {
    path: '/',
    element: <Home />,
    layout: 'app',
  },
  {
    path: '/events/category/:slug',
    element: <EventsBrowsePage />,
    layout: 'app',
  },
  {
    path: '/events/:id',
    element: <EventDetailPage />,
    layout: 'app',
  },
  {
    path: '/events',
    element: <EventsIndexPage />,
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
    element: <PendingApprovalPage />,
    layout: 'app',
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
    layout: 'app',
  },
  {
    path: '/admin',
    element: <AdminDashboard />,
    layout: 'app',
    protected: true,
    roles: ['admin'],
  },
  {
    path: '/admin/events',
    element: <AdminEventsPage />,
    layout: 'app',
    protected: true,
    roles: ['admin'],
  },
  {
    path: '/admin/events/:id/edit',
    element: <AdminEventEditPage />,
    layout: 'app',
    protected: true,
    roles: ['admin'],
  },
  {
    path: '/organizer',
    element: <OrganizerDashboardPage />,
    layout: 'app',
    protected: true,
    roles: ['organizer'],
  },
  {
    path: '/organizer/events/new',
    element: <OrganizerEventNewPage />,
    layout: 'app',
    protected: true,
    roles: ['organizer'],
  },
  {
    path: '/organizer/events/:id/edit',
    element: <OrganizerEventEditPage />,
    layout: 'app',
    protected: true,
    roles: ['organizer'],
  },
  {
    path: '/organizer/events',
    element: <OrganizerEventsPage />,
    layout: 'app',
    protected: true,
    roles: ['organizer'],
  },
];

export default routes;
