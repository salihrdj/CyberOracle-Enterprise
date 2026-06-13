import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: 'CyberOracle Enterprise',
    template: '%s | CyberOracle Enterprise',
  },
  description: 'Enterprise SOAR & Threat Intelligence Platform',
  keywords: ['cybersecurity', 'SIEM', 'SOAR', 'threat intelligence', 'vulnerability management'],
  authors: [{ name: 'CyberOracle' }],
  creator: 'CyberOracle',
  publisher: 'CyberOracle',
  robots: 'noindex, nofollow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'CyberOracle Enterprise',
    title: 'CyberOracle Enterprise',
    description: 'Enterprise SOAR & Threat Intelligence Platform',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CyberOracle Enterprise',
    description: 'Enterprise SOAR & Threat Intelligence Platform',
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export const viewport: Viewport = {
  themeColor: '#04050e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.svg" sizes="any" />
        <link rel="apple-touch-icon" href="/icons.svg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-bg text-txt font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}