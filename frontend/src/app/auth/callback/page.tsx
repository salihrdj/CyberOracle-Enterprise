'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield } from 'lucide-react';

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Auth0 handles the callback automatically via the API route
    // This page just shows a loading state while the session is established
    const timer = setTimeout(() => {
      router.push('/dashboard/siem');
      router.refresh();
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-bg">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-lavender/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-sky/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative z-10 w-full max-w-md glass rounded-3xl p-8 shadow-2xl border border-border/30 text-center">
        <div className="w-16 h-16 bg-accent-sky/20 border border-accent-sky/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-7 h-7 text-accent-sky animate-spin" />
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">Completing Authentication</h1>
        <p className="text-txt-dim text-sm">Establishing secure session...</p>
      </div>
    </div>
  );
}