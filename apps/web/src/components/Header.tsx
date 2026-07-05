'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Wallet, Copy, RefreshCw, Shield } from 'lucide-react';
import { useUser } from '@/lib/user-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function truncate(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

const NAV = [
  { href: '/', label: 'Games' },
  { href: '/seeds', label: 'Seeds' },
  { href: '/verify', label: 'Verify' },
] as const;

export function Header() {
  const pathname = usePathname();
  const { userId, balance, newIdentity } = useUser();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!userId) return;
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-play">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">CPlatform</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-brand-muted text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border border-border/60 bg-background/80',
              'px-3 py-1.5 text-sm'
            )}
          >
            <Wallet className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span className="hidden text-muted-foreground sm:inline">Balance</span>
            <span className="font-mono font-semibold tabular-nums">
              {balance === null ? '—' : balance.toFixed(2)}
            </span>
          </div>

          {userId && (
            <div
              className={cn(
                'hidden items-center gap-1 rounded-full border border-border/60',
                'bg-background/80 px-2 py-1 font-mono text-xs md:flex'
              )}
            >
              <span className="px-1 text-muted-foreground">{truncate(userId)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
                aria-label="Copy user id"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={newIdentity}
                aria-label="New identity"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              {copied && (
                <span className="pr-1 text-[10px] text-win" aria-live="polite">
                  copied
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-border/40 px-4 py-2 sm:hidden">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-brand-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}