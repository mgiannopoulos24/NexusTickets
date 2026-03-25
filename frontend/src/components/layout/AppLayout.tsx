import type { ReactNode } from 'react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

