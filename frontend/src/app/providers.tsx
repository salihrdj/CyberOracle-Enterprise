'use client';

import { UserProvider } from '@auth0/nextjs-auth0/client';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}