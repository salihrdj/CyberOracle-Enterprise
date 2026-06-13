'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  filter?: string;
  onFilterChange?: (value: string) => void;
}

export function DashboardLayout({ children, filter, onFilterChange }: DashboardLayoutProps) {
  const { user, error, isLoading } = useUser();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  if (!isLoading && (!user || error)) {
    router.push('/api/auth/login');
    return null;
  }

  const handleLogout = () => {
    router.push('/api/auth/logout');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-sky border-t-transparent rounded-full animate-spin" />
          <p className="text-txt-dim text-sm font-mono">Initializing secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen relative overflow-hidden bg-bg">
      {/* Ambient background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-lavender/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-sky/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-rose/5 rounded-full blur-3xl" />
      </div>

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 glass-strong rounded-xl text-txt hover:bg-white/10 transition"
        aria-label="Toggle sidebar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto lg:ml-64 flex flex-col min-w-0">
        <Header filter={filter} onFilterChange={onFilterChange} />
        <div className="flex-1 p-8 lg:p-10 pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}