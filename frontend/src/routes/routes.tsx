import React from 'react';

import Home from '@/pages/Home';

type RouteConfig = {
  path: string;
  element: React.ReactNode;
  protected?: boolean;
  roles?: Array<'attendee' | 'organizer' | 'admin'>;
};

const routes: RouteConfig[] = [
  {
    path: '/',
    element: <Home />,
  },
];

export default routes;
