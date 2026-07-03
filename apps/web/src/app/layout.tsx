import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { UserProvider } from '@/lib/user-context';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'CPlatform',
  description: 'Provably-fair gaming platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0b0f14] text-slate-100">
        <UserProvider>
          <Header />
          <main>{children}</main>
        </UserProvider>
      </body>
    </html>
  );
}
