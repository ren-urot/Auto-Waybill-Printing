import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

// Inter for UI/body text (matches the approved dashboard reference design).
// Geist Mono stays for tracking numbers, order numbers, and SKUs — that was
// a separate legibility choice for data codes, independent of the reference.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'OmniShip',
  description: 'Automated waybill printing for Shopify orders',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
