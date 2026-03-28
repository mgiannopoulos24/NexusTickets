import { Route, Routes } from 'react-router-dom';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/sonner';
import routes from '@/routes/routes';

function App() {
  const appRoutes = routes.filter((r) => r.layout !== 'none');
  const bareRoutes = routes.filter((r) => r.layout === 'none');

  return (
    <>
      <Toaster position="top-left" richColors closeButton />
      <Routes>
        <Route element={<AppShell />}>
          {appRoutes.map((route, index) => (
            <Route
              key={`${route.path}-${index}`}
              path={route.path}
              element={
                route.protected ? (
                  <ProtectedRoute allowedRoles={route.roles!}>{route.element}</ProtectedRoute>
                ) : (
                  route.element
                )
              }
            />
          ))}
        </Route>
        {bareRoutes.map((route, index) => (
          <Route
            key={`bare-${route.path}-${index}`}
            path={route.path}
            element={
              route.protected ? (
                <ProtectedRoute allowedRoles={route.roles!}>{route.element}</ProtectedRoute>
              ) : (
                route.element
              )
            }
          />
        ))}
      </Routes>
    </>
  );
}

export default App;
