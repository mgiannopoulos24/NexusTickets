import { Outlet } from 'react-router-dom';

import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { FloatingChat } from '@/components/chat/FloatingChat';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';

export function AppShell() {
  useWebSocket();
  const { accessToken } = useAuth();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <Outlet />
      <Footer />
      {accessToken && <FloatingChat />}
    </div>
  );
}
