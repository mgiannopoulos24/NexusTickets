import { lazy } from 'react';
import type { ReactNode } from 'react';
/* eslint-disable react-refresh/only-export-components */

type RouteConfig = {
  path: string;
  element: ReactNode;
  protected?: boolean;
  roles?: Array<'attendee' | 'organizer' | 'admin'>;
};

const Home = lazy(() => import('@/pages/Home'));

const routes: RouteConfig[] = [
  {
    path: '/',
    element: <Home />,
  },
  // {
  //   path: "/profile",
  //   element: <Profile />,
  //   protected: true,
  //   roles: ["attendee", "organizer", "admin"],
  // }
];

export default routes;
