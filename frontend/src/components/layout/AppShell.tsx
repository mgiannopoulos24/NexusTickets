import { Outlet } from 'react-router-dom';

import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { useWebSocket } from '@/hooks/useWebSocket';

export function AppShell() {
  useWebSocket();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
