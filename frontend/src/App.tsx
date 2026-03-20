import { Route, Routes } from 'react-router-dom';
import { useWebSocket } from '@/hooks/useWebSocket';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import routes from '@/routes/routes';

function App() {
  useWebSocket();

  return (
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
  );
}

export default App;
