'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useUser } from '@/lib/user-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function truncate(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function Header() {
  const { userId, balance, newIdentity } = useUser();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!userId) return;
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <Link href="/" className="text-lg font-bold">
        CPlatform
      </Link>
      <nav className="flex items-center gap-6 text-sm text-muted-foreground">
        <Link href="/seeds" className="hover:text-foreground">
          Seeds
        </Link>
        <Link href="/verify" className="hover:text-foreground">
          Verify
        </Link>
        <Badge variant="secondary">
          Balance: {balance === null ? '—' : balance.toFixed(2)}
        </Badge>
        {userId && (
          <span className="flex items-center gap-2 rounded bg-background px-2 py-1 font-mono text-xs">
            {truncate(userId)}
            <Button variant="ghost" size="sm" className="h-auto px-1 py-0" onClick={handleCopy}>
              {copied ? 'copied' : 'copy'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-1 py-0 text-muted-foreground hover:text-destructive"
              onClick={newIdentity}
            >
              new identity
            </Button>
          </span>
        )}
      </nav>
    </header>
  );
}
