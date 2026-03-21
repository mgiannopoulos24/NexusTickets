import { Route, Routes } from 'react-router-dom';
import { useWebSocket } from '@/hooks/useWebSocket';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import routes from '@/routes/routes';

function App() {
  useWebSocket();

  return (
    <>
      <Toaster position="top-left" richColors closeButton />
      <Routes>
        {routes.map((route, index) => (
          <Route
            key={index}
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
