import { Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import routes from '@/routes/routes';

function App() {
  useWebSocket();

  const withLayout = (
    layout: (typeof routes)[number]['layout'] | undefined,
    element: ReactNode,
  ) => {
    switch (layout ?? 'app') {
      case 'none':
        return element;
      case 'app':
      default:
        return <AppLayout>{element}</AppLayout>;
    }
  };

  return (
    <>
      <Toaster position="top-left" richColors closeButton />
      <Routes>
        {routes.map((route, index) => (
          <Route
            key={index}
            path={route.path}
            element={
              route.protected
                ? withLayout(
                    route.layout,
                    <ProtectedRoute allowedRoles={route.roles!}>{route.element}</ProtectedRoute>,
                  )
                : withLayout(route.layout, route.element)
            }
          />
        ))}
      </Routes>
    </>
  );
}

export default App;
