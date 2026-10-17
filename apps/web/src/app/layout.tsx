import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// One family, chosen to sit with the rounded geometric easytrip wordmark.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'easytrip fleet',
  description: 'Track every vehicle, rider, handover and cost in one place.',
  icons: {
    icon: [{ url: '/icon-32.png', sizes: '32x32' }, { url: '/icon-512.png', sizes: '512x512' }],
    apple: '/icon-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0E2748',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
