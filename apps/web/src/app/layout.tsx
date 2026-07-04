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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <UserProvider>
          <Header />
          <main>{children}</main>
        </UserProvider>
      </body>
    </html>
  );
}
